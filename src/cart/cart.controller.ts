import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Body,
  Param,
  UseGuards,
  Req,
} from "@nestjs/common";
import { CartService } from "./cart.service";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";

// ✅ Swagger imports
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

@ApiTags("Cart") // 👈 Group in Swagger UI
@ApiBearerAuth("JWT-auth") // 👈 Lock icon (JWT required)
@UseGuards(JwtAuthGuard)
@Controller("cart")
export class CartController {
  constructor(private cartService: CartService) {}

  // ---------------- GET CART ----------------
  @ApiOperation({
    summary: "Get current user's cart",
    description: "Returns all cart items for the logged-in user",
  })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @Get()
  getCart(@Req() req) {
    return this.cartService.getCart(req.user.id);
  }

  // ---------------- ADD TO CART ----------------
  @ApiOperation({
    summary: "Add product to cart",
    description:
      "Adds a product to cart. Size is required if product has sizes.",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        productId: { type: "number", example: 19 },
        variantId: { type: "number", example: 7, nullable: true },
        sizeId: { type: "number", example: 4, nullable: true },
        quantity: { type: "number", example: 2, default: 1 },
      },
      required: ["productId"],
    },
  })
  @ApiBadRequestResponse({
    description: "Please select a size / Out of stock / Invalid product",
  })
  @Post("add")
  add(
    @Req() req,
    @Body("productId") productId: number,
    @Body("variantId") variantId?: number,
    @Body("sizeId") sizeId?: number,
    @Body("quantity") quantity?: number
  ) {
    return this.cartService.addToCart(
      req.user.id,
      productId,
      variantId,
      sizeId,
      quantity
    );
  }

  // ---------------- UPDATE QUANTITY ----------------
  @ApiOperation({
    summary: "Update cart item quantity",
  })
  @ApiParam({
    name: "id",
    description: "Cart item ID",
    example: 12,
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        quantity: { type: "number", example: 2 },
      },
      required: ["quantity"],
    },
  })
  @ApiBadRequestResponse({
    description: "Quantity must be at least 1 / Not enough stock",
  })
  @Put(":id")
  update(
    @Req() req,
    @Param("id") id: string,
    @Body() body: { quantity: number }
  ) {
    return this.cartService.updateQuantity(
      +id,
      body.quantity,
      req.user.id
    );
  }

  // ---------------- REMOVE ITEM ----------------
  @ApiOperation({
    summary: "Remove item from cart",
  })
  @ApiParam({
    name: "id",
    description: "Cart item ID",
    example: 12,
  })
  @Delete(":id")
  remove(@Req() req, @Param("id") id: string) {
    return this.cartService.removeItem(+id, req.user.id);
  }
}
