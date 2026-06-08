import { Injectable, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { GoogleProfile } from "./strategies/google.strategy";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService
  ) {}

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

  // ----------------------------------------------------------
  // ADMIN LOGIN
  // ----------------------------------------------------------
  async validateAdmin(email: string, password: string) {
    const admin = await this.prisma.user.findUnique({ where: { email } });

    if (!admin || admin.role !== UserRole.ADMIN) {
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
