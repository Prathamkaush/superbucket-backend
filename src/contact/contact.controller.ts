import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  Query,
  Param,
  ParseIntPipe,
  Delete,
} from "@nestjs/common";
import { ContactService } from "./contact.service";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";
import { AdminGuard } from "../auth/admin.guard";
import { Patch } from "@nestjs/common";
import { UpdateContactStatusDto } from "./dto/update-contact-status.dto";
import { ContactStatus , ContactReason } from "@prisma/client";

// ✅ Swagger imports
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from "@nestjs/swagger";

@ApiTags("Contact")
@Controller("contact")
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  // -------- PUBLIC CONTACT FORM --------
  @ApiOperation({
    summary: "Submit contact form (Public)",
    description: "Allows users or guests to submit a contact / support request",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        name: { type: "string", example: "Pratham Kaushik" },
        email: { type: "string", example: "user@example.com" },
        phone: { type: "string", example: "9876543210" },
        message: {
          type: "string",
          example: "I need help with my order",
        },
      },
      required: ["name", "email", "message"],
    },
  })
  @Post()
  async create(@Req() req: any, @Body() body: any) {
    return this.contactService.createContact({
      ...body,
      userId: req.user?.id || null,
    });
  }

  // -------- ADMIN: LIST CONTACTS --------
  @ApiOperation({
    summary: "Get all contact submissions (Admin only)",
  })
  @ApiBearerAuth("JWT-auth")
  @ApiQuery({
    name: "page",
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    example: 10,
  })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Admin access required" })
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get()
@UseGuards(JwtAuthGuard, AdminGuard)
getAll(
  @Query("page") page = "1",
  @Query("limit") limit = "10",
  @Query("status") status?: ContactStatus,
  @Query("reason") reason?: ContactReason,
  @Query("search") search?: string,
) {
  return this.contactService.getAllContacts({
    page: Number(page),
    limit: Number(limit),
    status,
    reason,
    search,
  });
}


  // -------- ADMIN: VIEW SINGLE --------
  @ApiOperation({
    summary: "Get single contact message (Admin only)",
  })
  @ApiBearerAuth("JWT-auth")
  @ApiParam({
    name: "id",
    description: "Contact message ID",
    example: 12,
  })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Admin access required" })
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get(":id")
  getOne(@Param("id", ParseIntPipe) id: number) {
    return this.contactService.getById(id);
  }

  // -------- ADMIN: DELETE --------
  @ApiOperation({
    summary: "Delete contact message (Admin only)",
  })
  @ApiBearerAuth("JWT-auth")
  @ApiParam({
    name: "id",
    description: "Contact message ID",
    example: 12,
  })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Admin access required" })
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.contactService.delete(id);
  }
  // -------- ADMIN: Status Change --------
  @ApiOperation({
  summary: "Update contact status (Admin only)",
})
@ApiBearerAuth("JWT-auth")
@ApiParam({
  name: "id",
  description: "Contact message ID",
  example: 12,
})
@ApiBody({
  schema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["NEW", "IN_PROGRESS", "RESOLVED"],
        example: "IN_PROGRESS",
      },
    },
    required: ["status"],
  },
})
@ApiUnauthorizedResponse({ description: "Unauthorized" })
@ApiForbiddenResponse({ description: "Admin access required" })
@UseGuards(JwtAuthGuard, AdminGuard)
@Patch(":id/status")
updateStatus(
  @Param("id", ParseIntPipe) id: number,
  @Body() body: UpdateContactStatusDto
) {
  return this.contactService.updateStatus(id, body.status);
}

}
