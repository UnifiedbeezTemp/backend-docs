---
sidebar_position: 5
---

# Apple Sign In Integration Guide

## Overview

Apple Sign In uses OAuth2 authorization code flow with server-side token exchange and redirect-based authentication.

## Frontend Implementation

### 1. Install Apple JS SDK

Add to your HTML `<head>`:

```html
<script
  type="text/javascript"
  src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"
></script>
```

### 2. Configuration

```typescript
// config/appleAuth.ts
export const appleAuthConfig = {
  clientId: import.meta.env.VITE_APPLE_CLIENT_ID,
  redirectURI: import.meta.env.VITE_APPLE_REDIRECT_URI, // Backend callback URL
  scope: "name email",
  getState: (redirectPath: string = "/auth/callback") => {
    // Encode full frontend redirect URL in state
    const fullRedirectUrl = `${window.location.origin}${redirectPath}`;
    return btoa(
      JSON.stringify({
        redirect_url: fullRedirectUrl,
        mode: redirectPath.includes("signup") ? "signup" : "login",
      })
    );
  },
};
```

**Environment Variables:**

```env
VITE_APPLE_CLIENT_ID=com.yourcompany.yourapp.service
VITE_APPLE_REDIRECT_URI=https://api.yourdomain.com/api/v1/auth/apple/callback
```

### 3. Sign In Component

```typescript
import React, { useEffect } from "react";
import { appleAuthConfig } from "../config/appleAuth";

interface AppleAuthProps {
  mode: "signup" | "login";
  redirectPath?: string; // Optional custom redirect after auth
}

declare global {
  interface Window {
    AppleID: any;
  }
}

export const AppleAuth: React.FC<AppleAuthProps> = ({
  mode,
  redirectPath = "/auth/callback",
}) => {
  useEffect(() => {
    const script = document.createElement("script");
    script.src =
      "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
    script.async = true;
    script.onload = () => {
      if (window.AppleID) {
        window.AppleID.auth.init({
          clientId: appleAuthConfig.clientId,
          scope: appleAuthConfig.scope,
          redirectURI: appleAuthConfig.redirectURI,
          state: appleAuthConfig.getState(redirectPath),
          usePopup: false,
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [redirectPath]);

  const handleAppleAuth = async () => {
    try {
      if (!window.AppleID) {
        throw new Error("Apple ID SDK not loaded");
      }

      // Redirects to Apple, then to backend callback, then to frontend
      await window.AppleID.auth.signIn();
    } catch (error) {
      console.error("Apple auth error:", error);
    }
  };

  return (
    <button
      onClick={handleAppleAuth}
      className="apple-auth-btn"
      style={{
        backgroundColor: "#000",
        color: "white",
        border: "none",
        padding: "12px 24px",
        borderRadius: "4px",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: "600",
        width: "100%",
      }}
    >
      {mode === "signup" ? "Sign up" : "Sign in"} with Apple
    </button>
  );
};
```

### 4. Callback Handler Page

Create `/auth/callback` route:

```typescript
// pages/AuthCallback.tsx
import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success) {
      // Auth successful, session cookie set by backend
      navigate("/dashboard");
    } else if (error) {
      console.error("Auth error:", error);
      navigate("/login?error=" + encodeURIComponent(error));
    }
  }, [searchParams, navigate]);

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <p>Processing authentication...</p>
    </div>
  );
};
```

### 5. Usage

```typescript
// In your login/signup page
import { AppleAuth } from "../components/AppleAuth";

function LoginPage() {
  return (
    <div>
      <h1>Login</h1>
      <AppleAuth mode="login" redirectPath="/dashboard" />
    </div>
  );
}

function SignupPage() {
  return (
    <div>
      <h1>Sign Up</h1>
      <AppleAuth mode="signup" redirectPath="/onboarding" />
    </div>
  );
}
```

## Flow Diagram

```
1. User clicks "Sign in with Apple"
   ↓
2. Frontend calls AppleID.auth.signIn() with state containing redirect URL
   ↓
3. Redirects to Apple's auth page
   ↓
4. User authenticates with Apple
   ↓
5. Apple redirects to backend: POST /api/v1/auth/apple/callback
   ↓
6. Backend:
   - Parses state to get frontend redirect URL
   - Validates origin (*.unifiedbeez.com)
   - Exchanges code for tokens
   - Creates session
   - Sets httpOnly cookie
   ↓
7. Backend redirects to frontend URL from state: {origin}{redirectPath}?success=true
   ↓
8. Frontend callback page handles success/error
   ↓
9. Navigate to dashboard (session cookie already set)
```

## Session Management

- Session managed via **httpOnly cookie** (set by backend)
- No tokens exposed to frontend
- Cookie automatically sent with API requests
- Cookie settings: `httpOnly`, `secure`, `sameSite=none`

## Custom Redirect Paths

Frontend can specify where to redirect after auth:

```typescript
// Redirect to onboarding after signup
<AppleAuth mode="signup" redirectPath="/onboarding" />

// Redirect to dashboard after login
<AppleAuth mode="login" redirectPath="/dashboard" />

// Default: /auth/callback
<AppleAuth mode="login" />
```

Backend extracts and validates the full URL from state parameter.

## Error Handling

Backend redirects to callback with error query param:

```
/auth/callback?error=Authentication%20failed
```

Handle in callback page and show appropriate message.

## Apple Developer Console Setup

1. **App ID** - Enable Sign in with Apple capability
2. **Services ID** - Create with your client ID
3. **Return URLs** - Add backend callback URL (e.g., `https://api.yourdomain.com/api/v1/auth/apple/callback`)
4. **Domain verification** - Verify your domain
5. **Private Key** - Create for token signing (backend uses this)

## Security Notes

- Backend validates redirect URLs against allowed origins (`*.unifiedbeez.com`, localhost)
- State parameter base64-encoded to pass redirect URL safely
- Open redirect attacks prevented by origin validation
- First-time users: Apple returns user name
- Subsequent logins: Only email in ID token
