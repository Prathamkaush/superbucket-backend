import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePropertyDto } from "./dto/create-property.dto";
import { UpdatePropertyDto } from "./dto/update-property.dto";
import { CreateLeadDto } from "./dto/create-lead.dto";
import {
  PropertyMode,
  PropertyCategory,
  PropertyStatus,
  PropertyVerification,
  LeadStatus,
} from "@prisma/client";

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // OWNER / RENTER ACTIONS
  // -------------------------------------------------------------------------

  async createProperty(
    ownerId: number,
    dto: CreatePropertyDto,
    files?: { frontImage?: string; roomsImage?: string; docsFile?: string }
  ) {
    const verificationStatus = files?.docsFile
      ? PropertyVerification.DOCS_PENDING
      : PropertyVerification.NOT_SUBMITTED;

    return this.prisma.property.create({
      data: {
        title: dto.title,
        address: dto.address,
        pincode: dto.pincode,
        mode: dto.mode,
        category: dto.category,
        price: dto.price,
        size: dto.size,
        floor: dto.floor || null,
        furnished: dto.furnished || "UNFURNISHED",
        details: dto.details || null,
        frontImage: files?.frontImage || null,
        roomsImage: files?.roomsImage || null,
        docsFile: files?.docsFile || null,
        status: PropertyStatus.REVIEW, // Submits directly to admin review
        verification: verificationStatus,
        ownerId: ownerId,
      },
    });
  }

  async findMyProperties(ownerId: number) {
    return this.prisma.property.findMany({
      where: { ownerId },
      include: {
        _count: {
          select: { leads: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findMyLeads(ownerId: number) {
    return this.prisma.propertyLead.findMany({
      where: {
        property: {
          ownerId: ownerId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            profileImage: true,
          },
        },
        property: {
          select: {
            id: true,
            title: true,
            address: true,
            price: true,
            mode: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async updateProperty(
    id: number,
    ownerId: number,
    userRole: string,
    dto: UpdatePropertyDto,
    files?: { frontImage?: string; roomsImage?: string; docsFile?: string }
  ) {
    const property = await this.prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      throw new NotFoundException("Property listing not found");
    }

    if (userRole !== "ADMIN" && property.ownerId !== ownerId) {
      throw new ForbiddenException("You do not have permission to update this listing");
    }

    const updateData: any = { ...dto };

    if (files?.frontImage) updateData.frontImage = files.frontImage;
    if (files?.roomsImage) updateData.roomsImage = files.roomsImage;
    if (files?.docsFile) {
      updateData.docsFile = files.docsFile;
      updateData.verification = PropertyVerification.DOCS_PENDING;
    }

    // Reset status back to REVIEW if updated by owner to ensure re-review
    if (userRole !== "ADMIN") {
      updateData.status = PropertyStatus.REVIEW;
    }

    return this.prisma.property.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteProperty(id: number, ownerId: number, userRole: string) {
    const property = await this.prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      throw new NotFoundException("Property listing not found");
    }

    if (userRole !== "ADMIN" && property.ownerId !== ownerId) {
      throw new ForbiddenException("You do not have permission to delete this listing");
    }

    await this.prisma.property.delete({
      where: { id },
    });

    return { message: "Property listing deleted successfully" };
  }

  async advertiseProperty(id: number, ownerId: number, userRole: string) {
    const property = await this.prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      throw new NotFoundException("Property listing not found");
    }

    if (userRole !== "ADMIN" && property.ownerId !== ownerId) {
      throw new ForbiddenException(
        "You do not have permission to advertise this listing"
      );
    }

    return this.prisma.property.update({
      where: { id },
      data: { isAdvertised: true },
    });
  }

  async updateLeadStatus(leadId: number, ownerId: number, status: LeadStatus) {
    const lead = await this.prisma.propertyLead.findUnique({
      where: { id: leadId },
      include: {
        property: true,
      },
    });

    if (!lead) {
      throw new NotFoundException("Inquiry/lead not found");
    }

    if (lead.property.ownerId !== ownerId) {
      throw new ForbiddenException("You do not own the property associated with this lead");
    }

    return this.prisma.propertyLead.update({
      where: { id: leadId },
      data: { status },
    });
  }

  // -------------------------------------------------------------------------
  // PUBLIC / BUYER ACTIONS
  // -------------------------------------------------------------------------

  async findAdvertised() {
    return this.prisma.property.findMany({
      where: {
        isAdvertised: true,
        status: PropertyStatus.LIVE,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    });
  }

  async findAll(query: {
    category?: PropertyCategory;
    mode?: PropertyMode;
    search?: string;
    pincode?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      status: PropertyStatus.LIVE,
    };

    if (query.category) {
      whereClause.category = query.category;
    }

    if (query.mode) {
      whereClause.mode = query.mode;
    }

    if (query.search) {
      whereClause.OR = [
        { title: { contains: query.search } },
        { address: { contains: query.search } },
      ];
    }

    // PIN codes sharing the first three digits belong to the same postal
    // sorting district. This is a useful MVP approximation until listings
    // store latitude/longitude and can be sorted by real distance.
    if (/^\d{6}$/.test(query.pincode || "")) {
      whereClause.pincode = { startsWith: query.pincode!.slice(0, 3) };
    }

    const [total, properties] = await Promise.all([
      this.prisma.property.count({ where: whereClause }),
      this.prisma.property.findMany({
        where: whereClause,
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return {
      properties,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number, incrementView = false) {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!property) {
      throw new NotFoundException("Property listing not found");
    }

    if (incrementView && property.status === PropertyStatus.LIVE) {
      await this.prisma.property.update({
        where: { id },
        data: {
          views: { increment: 1 },
        },
      });
      property.views += 1;
    }

    return property;
  }

  async createLead(propertyId: number, userId: number, dto: CreateLeadDto) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException("Property listing not found");
    }

    if (property.status !== PropertyStatus.LIVE) {
      throw new BadRequestException("You cannot inquire about inactive properties");
    }

    if (property.ownerId === userId) {
      throw new BadRequestException("You cannot inquire about your own property listing");
    }

    const status = dto.visitTime ? LeadStatus.VISIT_BOOKED : LeadStatus.PENDING;

    return this.prisma.propertyLead.create({
      data: {
        propertyId,
        userId,
        status,
        message: dto.message || null,
        visitTime: dto.visitTime ? new Date(dto.visitTime) : null,
      },
    });
  }

  // -------------------------------------------------------------------------
  // ADMIN ACTIONS
  // -------------------------------------------------------------------------

  async adminFindPending() {
    return this.prisma.property.findMany({
      where: { status: PropertyStatus.REVIEW },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async adminApprove(id: number) {
    const property = await this.prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      throw new NotFoundException("Property listing not found");
    }

    return this.prisma.property.update({
      where: { id },
      data: {
        status: PropertyStatus.LIVE,
        verification: PropertyVerification.VERIFIED,
      },
    });
  }

  async adminReject(id: number) {
    const property = await this.prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      throw new NotFoundException("Property listing not found");
    }

    return this.prisma.property.update({
      where: { id },
      data: {
        status: PropertyStatus.REJECTED,
      },
    });
  }
}
