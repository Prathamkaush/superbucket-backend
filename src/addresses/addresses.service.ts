import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAddressDto } from "./dto/create-address.dto";
import { UpdateAddressDto } from "./dto/update-address.dto";

@Injectable()
export class AddressesService {
  constructor(private prisma: PrismaService) {}

  /* CREATE */
  async create(userId: number, dto: CreateAddressDto) {
    if ((dto.latitude == null) !== (dto.longitude == null)) {
      throw new BadRequestException("Both latitude and longitude are required together");
    }
    const addressCount = await this.prisma.userAddress.count({ where: { userId } });
    const isDefault = addressCount === 0 || Boolean(dto.isDefault);
    if (isDefault) {
      await this.prisma.userAddress.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return this.prisma.userAddress.create({
      data: {
        ...dto,
        isDefault,
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
    const existing = await this.findOne(id, userId);
    const nextLatitude = dto.latitude !== undefined ? dto.latitude : existing.latitude;
    const nextLongitude = dto.longitude !== undefined ? dto.longitude : existing.longitude;
    if ((nextLatitude == null) !== (nextLongitude == null)) {
      throw new BadRequestException("Both latitude and longitude are required together");
    }

    if (dto.isDefault) {
      await this.prisma.userAddress.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return this.prisma.userAddress.update({
      where: { id },
      data: {
        ...dto,
        // A user must always retain one default address while addresses exist.
        ...(existing.isDefault && dto.isDefault === false && { isDefault: true }),
      },
    });
  }

  /* DELETE */
  async remove(id: number, userId: number) {
    const address = await this.findOne(id, userId);
    const removed = await this.prisma.userAddress.delete({
      where: { id },
    });

    if (address.isDefault) {
      const nextAddress = await this.prisma.userAddress.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (nextAddress) {
        await this.prisma.userAddress.update({
          where: { id: nextAddress.id },
          data: { isDefault: true },
        });
      }
    }

    return removed;
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
