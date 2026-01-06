import sql from "@/app/api/utils/sql";

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.SPOTIFY_REDIRECT_URI ||
  "http://localhost:3000/api/auth/spotify/callback";

// POST /api/auth/spotify/callback - Handle PKCE callback and token exchange
export async function POST(request) {
  try {
    const body = await request.json();
    const { code, codeVerifier, redirectUri } = body;

    if (!code || !codeVerifier) {
      return Response.json(
        { error: "Missing required parameters: code and codeVerifier" },
        { status: 400 },
      );
    }

    if (!SPOTIFY_CLIENT_ID) {
      return Response.json(
        { error: "Spotify client ID not configured" },
        { status: 500 },
      );
    }

    // Exchange authorization code for access token using PKCE
    const tokenResponse = await fetch(
      "https://accounts.spotify.com/api/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: redirectUri,
          client_id: SPOTIFY_CLIENT_ID,
          code_verifier: codeVerifier,
        }),
      },
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("Token exchange failed:", errorData);
      return Response.json(
        {
          error: `Token exchange failed: ${errorData.error_description || errorData.error}`,
        },
        { status: 400 },
      );
    }

    const tokens = await tokenResponse.json();

    // Calculate token expiry
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

    // Store tokens in settings table
    const [existingSettings] = await sql`
      SELECT id FROM settings ORDER BY id DESC LIMIT 1
    `;

    if (existingSettings) {
      await sql`
        UPDATE settings 
        SET spotify_auth_token = ${tokens.access_token},
            spotify_refresh_token = ${tokens.refresh_token},
            spotify_expires_at = ${expiresAt.toISOString()},
            spotify_client_id = ${SPOTIFY_CLIENT_ID},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${existingSettings.id}
      `;
    } else {
      await sql`
        INSERT INTO settings (
          spotify_auth_token, 
          spotify_refresh_token, 
          spotify_expires_at,
          spotify_client_id,
          export_target,
          service_active
        )
        VALUES (
          ${tokens.access_token}, 
          ${tokens.refresh_token}, 
          ${expiresAt.toISOString()},
          ${SPOTIFY_CLIENT_ID},
          'spotify',
          false
        )
      `;
    }

    return Response.json({
      success: true,
      message: "Spotify authentication successful",
    });
  } catch (error) {
    console.error("Spotify PKCE callback error:", error);
    return Response.json(
      { error: "Internal server error during authentication" },
      { status: 500 },
    );
  }
}

// GET /api/auth/spotify/callback - Handle OAuth callback from Spotify (legacy)
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("Spotify OAuth error:", error);
      return Response.redirect(
        `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/settings?spotify_error=${error}`,
      );
    }

    if (!code) {
      console.error("No authorization code received from Spotify");
      return Response.redirect(
        `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/settings?spotify_error=no_code`,
      );
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(
      "https://accounts.spotify.com/api/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: REDIRECT_URI,
        }),
      },
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Spotify token exchange failed:", errorText);
      return Response.redirect(
        `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/settings?spotify_error=token_exchange_failed`,
      );
    }

    const tokens = await tokenResponse.json();

    // Get user profile to verify the token works
    const userResponse = await fetch("https://api.spotify.com/v1/me", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userResponse.ok) {
      console.error("Failed to get Spotify user profile");
      return Response.redirect(
        `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/settings?spotify_error=profile_failed`,
      );
    }

    const user = await userResponse.json();

    // Store or update tokens in settings table
    try {
      // Calculate token expiry
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

      // First, check if we have any settings record
      const [existingSettings] =
        await sql`SELECT id FROM settings ORDER BY id DESC LIMIT 1`;

      if (existingSettings) {
        // Update existing record
        await sql`
          UPDATE settings SET
            spotify_auth_token = ${tokens.access_token},
            spotify_refresh_token = ${tokens.refresh_token},
            spotify_expires_at = ${expiresAt.toISOString()},
            spotify_client_id = ${SPOTIFY_CLIENT_ID},
            spotify_client_secret = ${SPOTIFY_CLIENT_SECRET},
            updated_at = NOW()
          WHERE id = ${existingSettings.id}
        `;
      } else {
        // Create new settings record
        await sql`
          INSERT INTO settings (
            spotify_auth_token, 
            spotify_refresh_token,
            spotify_expires_at,
            spotify_client_id,
            spotify_client_secret,
            export_target,
            service_active,
            updated_at
          )
          VALUES (
            ${tokens.access_token},
            ${tokens.refresh_token},
            ${expiresAt.toISOString()},
            ${SPOTIFY_CLIENT_ID},
            ${SPOTIFY_CLIENT_SECRET},
            'spotify',
            false,
            NOW()
          )
        `;
      }

      console.log(
        "Spotify tokens stored successfully for user:",
        user.display_name,
      );

      // Redirect back to settings with success message
      return Response.redirect(
        `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/?spotify_success=true&user=${encodeURIComponent(user.display_name)}`,
      );
    } catch (dbError) {
      console.error("Database error storing Spotify tokens:", dbError);
      return Response.redirect(
        `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/settings?spotify_error=database_error`,
      );
    }
  } catch (error) {
    console.error("Spotify OAuth callback error:", error);
    return Response.redirect(
      `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/settings?spotify_error=callback_error`,
    );
  }
}
