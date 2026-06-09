import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  Query,
  ParseIntPipe,
} from "@nestjs/common";
import { ReviewsService } from "./reviews.service";
import { CreateReviewDto } from "./dto/create-review.dto";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";
import { AdminGuard } from "../auth/admin.guard";
import { UpdateReviewStatusDto } from "./dto/update-review-status.dto";

// ✅ Swagger
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from "@nestjs/swagger";

@ApiTags("Reviews")
@Controller("reviews")
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /* ================= ADMIN: GET ALL REVIEWS ================= */
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get all reviews (Admin)",
    description: "Returns paginated list of all reviews for admin dashboard",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (default: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page (default: 5)",
  })
  @ApiUnauthorizedResponse({ description: "Admin authentication required" })
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get("admin")
  getAllReviews(
    @Query("page") page = "1",
    @Query("limit") limit = "5"
  ) {
    return this.reviewsService.getAllPaginated(
      Number(page),
      Number(limit)
    );
  }

  /* ================= CREATE REVIEW ================= */
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Create a review",
    description: "Authenticated user can submit a product review",
  })
  @ApiBody({ type: CreateReviewDto })
  @ApiUnauthorizedResponse({ description: "User must be logged in" })
  @ApiBadRequestResponse({ description: "Invalid review data" })
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: any, @Body() dto: CreateReviewDto) {
    return this.reviewsService.createReview(req.user.id, dto);
  }

  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Approve or reject a review (Admin)" })
  @ApiParam({ name: "id", type: Number, description: "Review ID" })
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch("admin/:id/status")
  updateReviewStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateReviewStatusDto,
  ) {
    return this.reviewsService.updateStatus(id, dto.status);
  }

  @ApiOperation({
    summary: "Get latest public reviews",
    description: "Returns the latest product ratings for storefront sections",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
  })
  @Get("latest")
  getLatestReviews(@Query("limit") limit = "4") {
    return this.reviewsService.getLatest(Number(limit));
  }

  /* ================= GET PRODUCT REVIEWS ================= */
  @ApiOperation({
    summary: "Get reviews for a product",
    description: "Returns all approved reviews for a specific product",
  })
  @ApiParam({
    name: "productId",
    type: Number,
    description: "Product ID",
  })
  @Get("product/:productId")
  getProductReviews(
    @Param("productId", ParseIntPipe) productId: number
  ) {
    return this.reviewsService.getProductReviews(productId);
  }
}
