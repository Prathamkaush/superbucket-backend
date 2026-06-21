import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // ---------------- GET PROFILE ----------------
  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        profileImage: true,
        role: true,
        isVerified: true,
        bankAccountNumber: true,
        bankIfsc: true,
        bankAccountName: true,
        createdAt: true,
      },
    });

    if (!user) throw new NotFoundException("User not found");

    return { user };
  }

  // ---------------- UPDATE PROFILE ----------------
  async updateProfile(
    userId: number,
    data: UpdateProfileDto,
    profileImage?: string,
  ) {
    const email = data.email.trim().toLowerCase();
    const phone = data.phone.trim();

    const existingEmail = await this.prisma.user.findFirst({
      where: {
        email,
        NOT: { id: userId },
      },
    });

    if (existingEmail) {
      throw new BadRequestException("Email already in use");
    }

    const existingPhone = await this.prisma.user.findFirst({
      where: {
        phone,
        NOT: { id: userId },
      },
    });

    if (existingPhone) {
      throw new BadRequestException("Phone number already in use");
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name.trim(),
        email,
        phone,
        ...(profileImage
          ? { profileImage: `/uploads/profiles/${profileImage}` }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        profileImage: true,
        role: true,
        isVerified: true,
        bankAccountNumber: true,
        bankIfsc: true,
        bankAccountName: true,
      },
    });

    return {
      message: "Profile updated successfully",
      user,
    };
  }

  // ---------------- UPDATE BANK DETAILS ----------------
  async updateBankDetails(
    userId: number,
    bankAccountNumber: string,
    bankIfsc: string,
    bankAccountName: string,
  ) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        bankAccountNumber: bankAccountNumber ? bankAccountNumber.trim() : null,
        bankIfsc: bankIfsc ? bankIfsc.trim().toUpperCase() : null,
        bankAccountName: bankAccountName ? bankAccountName.trim() : null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        profileImage: true,
        role: true,
        isVerified: true,
        bankAccountNumber: true,
        bankIfsc: true,
        bankAccountName: true,
      },
    });

    return {
      message: "Bank details updated successfully",
      user,
    };
  }
}
