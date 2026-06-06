import {
  Controller,
  Post,
  Get,
  Req,
  UseGuards,
  Body,
  Query,
} from "@nestjs/common";
import { WishlistService } from "./wishlist.service";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";

// ✅ Swagger
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiBody,
  ApiQuery,
  ApiResponse,
} from "@nestjs/swagger";

@ApiTags("Wishlist")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("wishlist")
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  // ---------------- TOGGLE WISHLIST ----------------
  @Post("toggle")
  @ApiOperation({
    summary: "Add or remove product from wishlist",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        productId: {
          type: "number",
          example: 19,
        },
        variantId: {
          type: "number",
          example: 7,
          nullable: true,
        },
      },
      required: ["productId"],
    },
  })
  @ApiResponse({ status: 200, description: "Wishlist updated" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  toggle(
    @Req() req,
    @Body() body: { productId: number; variantId?: number }
  ) {
    return this.wishlistService.toggleWishlist(
      req.user.id,
      body.productId,
      body.variantId
    );
  }

  // ---------------- GET MY WISHLIST ----------------
  @Get()
  @ApiOperation({
    summary: "Get logged-in user's wishlist",
  })
  @ApiResponse({ status: 200, description: "Wishlist fetched" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  getMyWishlist(@Req() req: any) {
    return this.wishlistService.getUserWishlist(req.user.id);
  }

  // ---------------- CHECK WISHLIST ----------------
  @Get("check")
  @ApiOperation({
    summary: "Check if product is wishlisted by user",
  })
  @ApiQuery({
    name: "productId",
    required: true,
    example: 19,
  })
  @ApiResponse({
    status: 200,
    description: "Wishlist status",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  check(
    @Req() req: any,
    @Query("productId") productId: string,
    @Query("variantId") variantId?: string
  ) {
    return this.wishlistService.isWishlisted(
      req.user.id,
      Number(productId),
      variantId ? Number(variantId) : undefined
    );
  }
}

