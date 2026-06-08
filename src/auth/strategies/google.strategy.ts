import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, VerifyCallback } from "passport-google-oauth20";

export type GoogleProfile = {
  googleId: string;
  email: string;
  name: string;
  profileImage?: string;
};

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || "missing-google-client-id",
      clientSecret:
        process.env.GOOGLE_CLIENT_SECRET || "missing-google-client-secret",
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        "http://localhost:3030/auth/google/callback",
      scope: ["email", "profile"],
    });
  }

  validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    const email = profile.emails?.[0]?.value?.toLowerCase() || "";
    const firstName = profile.name?.givenName || "";
    const lastName = profile.name?.familyName || "";
    const displayName = profile.displayName || `${firstName} ${lastName}`.trim();

    const user: GoogleProfile = {
      googleId: profile.id,
      email,
      name: displayName || email,
      profileImage: profile.photos?.[0]?.value,
    };

    done(null, user);
  }
}
