import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { join } from "path";
import * as express from "express";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import * as dotenv from "dotenv";

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log", "debug", "verbose"],
    bodyParser: false,
  });

  // =====================================================
  // TRUST PROXY (nginx / Cloudflare)
  // =====================================================
  const server = app.getHttpAdapter().getInstance();
  server.set("trust proxy", 1);

  // =====================================================
  // BODY LIMITS
  // =====================================================
  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ limit: "100mb", extended: true }));

  // =====================================================
  // CORS (NestJS ONLY — nginx is neutral)
  // =====================================================
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",

    // User frontend
    "https://www.firstfemale.in",
    "https://firstfemale.in",

    // Admin frontend
    "https://www.v2admin.firstfemale.in",
    "https://v2admin.firstfemale.in",

    // Legacy
    "https://first-female-users.vercel.app",
    "https://first-female-admin.vercel.app",

    // Swagger UI
    "https://api.firstfemale.in",
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // allow Postman / curl / server-side
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS blocked"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], // ✅ IMPORTANT
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // =====================================================
  // STATIC FILES
  // =====================================================
  app.use("/uploads", express.static(join(process.cwd(), "uploads")));

  // =====================================================
  // VALIDATION
  // =====================================================
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // =====================================================
  // ENV CHECK
  // =====================================================
  console.log("🔑 RAZORPAY_KEY_ID =", process.env.RAZORPAY_KEY_ID);
  console.log(
    "🔑 RAZORPAY_KEY_SECRET exists =",
    Boolean(process.env.RAZORPAY_KEY_SECRET),
  );

  // =====================================================
  // SWAGGER
  // =====================================================
  const config = new DocumentBuilder()
    .setTitle("FirstFemale API")
    .setDescription("E-commerce backend API documentation")
    .setVersion("1.0")
    .addServer("https://api.firstfemale.in")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
      "JWT-auth",
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  // =====================================================
  // START SERVER
  // =====================================================
  const PORT = process.env.PORT || 3030;
  await app.listen(PORT, "0.0.0.0");

  console.log(`🚀 Backend running on port ${PORT}`);
}

bootstrap();
