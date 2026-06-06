import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  Query,
} from "@nestjs/common";
import { FeedbackService } from "./feedback.service";
import { CreateFeedbackDto } from "./dto/create-feedback.dto";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";
import { AdminGuard } from "../auth/admin.guard";

// ✅ Swagger imports
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiBearerAuth,
  ApiQuery,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from "@nestjs/swagger";

@ApiTags("Feedback")
@Controller("feedback")
export class FeedbackController {
  constructor(private readonly service: FeedbackService) {}

  /* -------- CREATE FEEDBACK (PUBLIC / OPTIONAL AUTH) -------- */
  @ApiOperation({
    summary: "Submit feedback (Public / Logged-in users)",
    description:
      "Allows users or guests to submit feedback. If logged in, feedback is linked to the user.",
  })
  @ApiBody({
    type: CreateFeedbackDto,
    description: "Feedback payload",
  })
  @Post()
  create(@Req() req: any, @Body() dto: CreateFeedbackDto) {
    const userId = req.user?.id || null;
    return this.service.create(userId, dto);
  }

  /* -------- ADMIN: VIEW ALL FEEDBACK -------- */
  @ApiOperation({
    summary: "Get all feedback (Admin only)",
    description: "Paginated list of all feedback submitted by users",
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
    example: 5,
  })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Admin access required" })
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get()
  getAll(
    @Query("page") page = "1",
    @Query("limit") limit = "5"
  ) {
    return this.service.getAll(Number(page), Number(limit));
  }
}
