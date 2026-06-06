import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAddressDto } from "./dto/create-address.dto";
import { UpdateAddressDto } from "./dto/update-address.dto";

@Injectable()
export class AddressesService {
  constructor(private prisma: PrismaService) {}

  /* CREATE */
  async create(userId: number, dto: CreateAddressDto) {
    if (dto.isDefault) {
      await this.prisma.userAddress.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return this.prisma.userAddress.create({
      data: {
        ...dto,
        userId,
      },
    });
  }

  /* LIST */
  async findAll(userId: number) {
    return this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "desc" },
      ],
    });
  }

  /* GET ONE */
  async findOne(id: number, userId: number) {
    const address = await this.prisma.userAddress.findFirst({
      where: { id, userId },
    });

    if (!address) {
      throw new NotFoundException("Address not found");
    }

    return address;
  }

  /* UPDATE */
  async update(id: number, userId: number, dto: UpdateAddressDto) {
    await this.findOne(id, userId);

    if (dto.isDefault) {
      await this.prisma.userAddress.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return this.prisma.userAddress.update({
      where: { id },
      data: dto,
    });
  }

  /* DELETE */
  async remove(id: number, userId: number) {
    await this.findOne(id, userId);

    return this.prisma.userAddress.delete({
      where: { id },
    });
  }

  /* SET DEFAULT */
  async setDefault(id: number, userId: number) {
    await this.findOne(id, userId);

    await this.prisma.userAddress.updateMany({
      where: { userId },
      data: { isDefault: false },
    });

    return this.prisma.userAddress.update({
      where: { id },
      data: { isDefault: true },
    });
  }
}
