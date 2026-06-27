import { Injectable, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { GoogleProfile } from "./strategies/google.strategy";
import { OAuth2Client } from "google-auth-library";
import axios from "axios";
import { randomInt } from "crypto";

type OtpChallenge = {
  purpose: "phone_otp";
  phone: string;
  sessionId: string;
};

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();
  private readonly otpSendTimes = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {}

  private normalizeIndianPhone(value: string) {
    const digits = String(value || "").replace(/\D/g, "");
    const phone = digits.startsWith("91") && digits.length === 12
      ? digits.slice(2)
      : digits;

    if (!/^[6-9]\d{9}$/.test(phone)) {
      throw new BadRequestException("Enter a valid 10-digit Indian mobile number");
    }

    return phone;
  }

  private getTwoFactorApiKey() {
    const apiKey =
      process.env.TWO_FACTOR_API_KEY ||
      process.env.TWOFACTOR_API_KEY ||
      process.env.SMS_TOKEN_KEY;

    if (!apiKey) {
      throw new BadRequestException("OTP service is not configured");
    }

    return apiKey;
  }

  private getTwoFactorTemplateName() {
    const template = String(
      process.env.TWO_FACTOR_OTP_TEMPLATE ||
        process.env.TWOFACTOR_OTP_TEMPLATE ||
        "",
    ).trim();

    if (!template) {
      throw new BadRequestException(
        "SMS OTP template is not configured. Set TWO_FACTOR_OTP_TEMPLATE to the approved 2Factor template name",
      );
    }

    return template;
  }

  async sendPhoneOtp(phoneValue: string) {
    const phone = this.normalizeIndianPhone(phoneValue);
    const lastSentAt = this.otpSendTimes.get(phone) || 0;
    const retryAfter = Math.ceil((30_000 - (Date.now() - lastSentAt)) / 1000);

    if (retryAfter > 0) {
      throw new BadRequestException(
        `Please wait ${retryAfter} seconds before requesting another OTP`,
      );
    }

    const apiKey = this.getTwoFactorApiKey();
    const template = this.getTwoFactorTemplateName();
    const otp = randomInt(1000, 10_000).toString();
    const path = [
      "https://2factor.in/API/V1",
      encodeURIComponent(apiKey),
      "SMS",
      `91${phone}`,
      otp,
      ...(template ? [encodeURIComponent(template)] : []),
    ].join("/");

    try {
      const response = await axios.get(path, { timeout: 10_000 });
      const sessionId = response.data?.Details;

      if (response.data?.Status !== "Success" || !sessionId) {
        throw new Error(response.data?.Details || "OTP could not be sent");
      }

      this.otpSendTimes.set(phone, Date.now());
      const challengeToken = this.jwtService.sign(
        { purpose: "phone_otp", phone, sessionId },
        { expiresIn: "5m" },
      );

      return {
        challengeToken,
        phone: `+91${phone}`,
        deliveryMethod: "SMS",
        expiresIn: 300,
        resendAfter: 30,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        error?.response?.data?.Details ||
          error?.message ||
          "Unable to send OTP right now",
      );
    }
  }

  async verifyPhoneOtp(challengeToken: string, otpValue: string) {
    const otp = String(otpValue || "").trim();
    if (!/^\d{4}$/.test(otp)) {
      throw new BadRequestException("Enter the complete 4-digit OTP");
    }

    let challenge: OtpChallenge;
    try {
      challenge = this.jwtService.verify(challengeToken) as OtpChallenge;
    } catch {
      throw new UnauthorizedException("OTP session expired. Request a new OTP");
    }

    if (
      challenge.purpose !== "phone_otp" ||
      !challenge.phone ||
      !challenge.sessionId
    ) {
      throw new UnauthorizedException("Invalid OTP session");
    }

    const apiKey = this.getTwoFactorApiKey();
    const verifyUrl = [
      "https://2factor.in/API/V1",
      encodeURIComponent(apiKey),
      "SMS",
      "VERIFY",
      encodeURIComponent(challenge.sessionId),
      encodeURIComponent(otp),
    ].join("/");

    try {
      const response = await axios.get(verifyUrl, { timeout: 10_000 });
      if (response.data?.Status !== "Success") {
        throw new UnauthorizedException(
          response.data?.Details || "Incorrect or expired OTP",
        );
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException(
        error?.response?.data?.Details || "Incorrect or expired OTP",
      );
    }

    const user = await this.prisma.user.upsert({
      where: { phone: challenge.phone },
      update: { isVerified: true },
      create: {
        phone: challenge.phone,
        name: `Superbuket User ${challenge.phone.slice(-4)}`,
        isVerified: true,
        role: UserRole.USER,
      },
    });

    const token = this.jwtService.sign({
      sub: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
    });

    return { token, user };
  }

  // ----------------------------------------------------------
  // EMAIL/PASSWORD LOGIN
  // ----------------------------------------------------------
  async login(email: string, password: string) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const cleanPassword = String(password || "");

    if (!normalizedEmail || !cleanPassword) {
      throw new BadRequestException("Email and password are required");
    }

    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) throw new UnauthorizedException("User not found");
    if (!user.passwordHash) throw new UnauthorizedException("Please register with email and password");

    const isMatch = await bcrypt.compare(cleanPassword, user.passwordHash);
    if (!isMatch) throw new UnauthorizedException("Incorrect password");

    // Create token with consistent payload structure
    const token = this.jwtService.sign({
      sub: user.id,
      phone: user.phone,  // Include phone even if null
      email: user.email,
      role: user.role,
    });

    return { token, user };
  }

  // ----------------------------------------------------------
  // CUSTOMER REGISTER
  // ----------------------------------------------------------
  async register(body: { name: string; email: string; password: string }) {
    const cleanName = String(body.name || "").trim();
    const normalizedEmail = String(body.email || "").trim().toLowerCase();
    const cleanPassword = String(body.password || "");

    if (!cleanName || !normalizedEmail || !cleanPassword) {
      throw new BadRequestException("Name, email and password are required");
    }

    if (cleanPassword.length < 6) {
      throw new BadRequestException("Password must be at least 6 characters");
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new BadRequestException("Email already registered");
    }

    const passwordHash = await bcrypt.hash(cleanPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        name: cleanName,
        email: normalizedEmail,
        passwordHash,
        isVerified: true,
        role: UserRole.USER,
      },
    });

    const token = this.jwtService.sign({
      sub: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
    });

    return { token, user };
  }

  // ----------------------------------------------------------
  // GOOGLE LOGIN / REGISTER
  // ----------------------------------------------------------
  async googleLogin(profile: GoogleProfile) {
    if (!profile.email || !profile.googleId) {
      throw new BadRequestException("Google account email is required");
    }

    const email = profile.email.trim().toLowerCase();
    const existingByGoogleId = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });

    let user = existingByGoogleId;

    if (!user) {
      const existingByEmail = await this.prisma.user.findUnique({
        where: { email },
      });

      user = existingByEmail
        ? await this.prisma.user.update({
            where: { id: existingByEmail.id },
            data: {
              googleId: profile.googleId,
              name: existingByEmail.name || profile.name,
              profileImage: existingByEmail.profileImage || profile.profileImage,
              isVerified: true,
            },
          })
        : await this.prisma.user.create({
            data: {
              googleId: profile.googleId,
              email,
              name: profile.name,
              profileImage: profile.profileImage,
              isVerified: true,
              role: UserRole.USER,
            },
          });
    }

    const token = this.jwtService.sign({
      sub: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
    });

    return { token, user };
  }

  async googleMobileLogin(idToken: string) {
    const audience =
      process.env.GOOGLE_WEB_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;

    if (!audience) {
      throw new BadRequestException(
        "Google authentication is not configured on the server",
      );
    }

    if (!idToken) {
      throw new BadRequestException("Google ID token is required");
    }

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience,
      });
      const payload = ticket.getPayload();

      if (
        !payload?.sub ||
        !payload.email ||
        payload.email_verified !== true
      ) {
        throw new UnauthorizedException("Google account could not be verified");
      }

      return this.googleLogin({
        googleId: payload.sub,
        email: payload.email,
        name: payload.name || payload.email,
        profileImage: payload.picture,
      });
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException("Invalid or expired Google ID token");
    }
  }

  // ----------------------------------------------------------
  // ADMIN LOGIN
  // ----------------------------------------------------------
  async validateAdmin(email: string, password: string) {
    const admin = await this.prisma.user.findUnique({ where: { email } });

    if (
      !admin ||
      !([UserRole.ADMIN, UserRole.SUB_ADMIN, UserRole.PICKER] as UserRole[]).includes(admin.role)
    ) {
      throw new UnauthorizedException("Invalid admin credentials");
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) throw new UnauthorizedException("Incorrect password");

    // Create token with consistent payload structure
    const token = this.jwtService.sign({
      sub: admin.id,
      phone: admin.phone,  // Include phone even if null
      email: admin.email,
      role: admin.role,
    });

    return { token, user: admin };
  }
}
