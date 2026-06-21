import {
  Body,
  Controller,
  Post,
  Get,
  UseGuards,
  Req,
  Res,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./strategies/jwt-auth.guard";
import { IsString, IsNotEmpty, IsEmail, Matches } from "class-validator";

// ✅ Swagger imports
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from "@nestjs/swagger";

// ---------------- DTOs ----------------
class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

class RegisterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  fullName?: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

class AdminLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

class GoogleMobileLoginDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;
}

class SendPhoneOtpDto {
  @IsString()
  @Matches(/^(\+?91)?[6-9]\d{9}$/, {
    message: "Enter a valid 10-digit Indian mobile number",
  })
  phone: string;
}

class VerifyPhoneOtpDto {
  @IsString()
  @IsNotEmpty()
  challengeToken: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: "OTP must be 4 digits" })
  otp: string;
}

// ---------------------------------------

@ApiTags("Auth") // 👈 Swagger group
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: "Send login OTP to an Indian mobile number" })
  @ApiBody({ type: SendPhoneOtpDto })
  @Post("phone/send-otp")
  sendPhoneOtp(@Body() body: SendPhoneOtpDto) {
    return this.authService.sendPhoneOtp(body.phone);
  }

  @ApiOperation({ summary: "Verify mobile OTP and login or register user" })
  @ApiBody({ type: VerifyPhoneOtpDto })
  @Post("phone/verify-otp")
  verifyPhoneOtp(@Body() body: VerifyPhoneOtpDto) {
    return this.authService.verifyPhoneOtp(body.challengeToken, body.otp);
  }

  // ---------------- EMAIL/PASSWORD LOGIN ----------------
  @ApiOperation({
    summary: "User login with email & password",
  })
  @ApiBody({ type: LoginDto })
  @ApiUnauthorizedResponse({ description: "Invalid credentials" })
  @Post("login")
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  // ---------------- CUSTOMER REGISTER ----------------
  @ApiOperation({
    summary: "Customer register with name, email & password",
  })
  @ApiBody({ type: RegisterDto })
  @ApiBadRequestResponse({ description: "Email already registered / Invalid details" })
  @Post("register")
  register(@Body() body: RegisterDto) {
    return this.authService.register({
      name: body.name || body.fullName || "",
      email: body.email,
      password: body.password,
    });
  }

  // ---------------- ADMIN LOGIN ----------------
  @ApiOperation({
    summary: "Admin login",
    description: "Admin login using email & password",
  })
  @ApiBody({ type: AdminLoginDto })
  @ApiUnauthorizedResponse({ description: "Invalid admin credentials" })
  @Post("admin/login")
  adminLogin(@Body() body: AdminLoginDto) {
    return this.authService.validateAdmin(body.email, body.password);
  }

  @ApiOperation({
    summary: "Google login for Android and iOS applications",
  })
  @ApiBody({ type: GoogleMobileLoginDto })
  @ApiUnauthorizedResponse({ description: "Invalid Google ID token" })
  @Post("google/mobile")
  googleMobileLogin(@Body() body: GoogleMobileLoginDto) {
    return this.authService.googleMobileLogin(body.idToken);
  }

  // ---------------- USER PROFILE ----------------
  @ApiOperation({
    summary: "Get logged-in user profile",
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@Req() req: any) {
    return req.user;
  }

  // ---------------- GOOGLE LOGIN ----------------
  @ApiOperation({
    summary: "Start Google login",
  })
  @Get("google")
  @UseGuards(AuthGuard("google"))
  googleAuth() {
    return;
  }

  @ApiOperation({
    summary: "Google login callback",
  })
  @Get("google/callback")
  @UseGuards(AuthGuard("google"))
  async googleAuthCallback(@Req() req: any, @Res() res: any) {
    const data = await this.authService.googleLogin(req.user);
    const frontendUrl =
      process.env.CUSTOMER_FRONTEND_URL ||
      process.env.FRONTEND_URL ||
      "http://localhost:3000";

    const params = new URLSearchParams({
      token: data.token,
      user: Buffer.from(JSON.stringify(data.user), "utf8").toString("base64url"),
    });

    return res.redirect(`${frontendUrl}/auth/google/callback?${params.toString()}`);
  }
}
