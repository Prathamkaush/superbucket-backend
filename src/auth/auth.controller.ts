import {
  Body,
  Controller,
  Post,
  Get,
  UseGuards,
  Req,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./strategies/jwt-auth.guard";
import { IsString, IsNotEmpty, IsEmail } from "class-validator";

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

// ---------------------------------------

@ApiTags("Auth") // 👈 Swagger group
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
}
