---
sidebar_position: 5
---

# Apple Sign In Integration Guide

## Overview

Apple Sign In uses OAuth2 authorization code flow with server-side token exchange.

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
};
```

**Environment Variables:**

```env
VITE_APPLE_CLIENT_ID=com.yourcompany.yourapp.service
VITE_APPLE_REDIRECT_URI=https://yourdomain.com/api/v1/auth/apple/callback
```

### 3. Sign In Component

```typescript
import React, { useEffect } from "react";
import { appleAuthConfig } from "../config/appleAuth";

interface AppleAuthProps {
  mode: "signup" | "login";
}

declare global {
  interface Window {
    AppleID: any;
  }
}

export const AppleAuth: React.FC<AppleAuthProps> = ({ mode }) => {
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
          state: mode, // Pass signup/login mode
          usePopup: false, // Use redirect flow
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [mode]);

  const handleAppleAuth = async () => {
    try {
      if (!window.AppleID) {
        throw new Error("Apple ID SDK not loaded");
      }

      // Redirects to Apple, then back to redirectURI
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
      // Show error message
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
      <AppleAuth mode="login" />
    </div>
  );
}

function SignupPage() {
  return (
    <div>
      <h1>Sign Up</h1>
      <AppleAuth mode="signup" />
    </div>
  );
}
```

## Flow Diagram

```
1. User clicks "Sign in with Apple"
   ↓
2. Frontend calls AppleID.auth.signIn()
   ↓
3. Redirects to Apple's auth page
   ↓
4. User authenticates with Apple
   ↓
5. Apple redirects to backend: POST /api/v1/auth/apple/callback
   ↓
6. Backend exchanges code for tokens, creates session
   ↓
7. Backend redirects to: /auth/callback?success=true
   ↓
8. Frontend callback page handles success/error
   ↓
9. Navigate to dashboard (session cookie already set)
```

## Session Management

- Session is managed via **httpOnly cookie** (set by backend)
- No need to handle tokens in frontend
- Cookie is automatically sent with API requests
- Cookie settings: `httpOnly`, `secure`, `sameSite=none`

## Error Handling

Backend redirects to callback with error query param:

```
/auth/callback?error=Authentication%20failed
```

Handle in callback page and show appropriate message to user.

## Apple Developer Console Setup

Required configuration:

1. **App ID** - Enable Sign in with Apple capability
2. **Services ID** - Create with your client ID
3. **Return URLs** - Add backend callback URL
4. **Domain verification** - Verify your domain
5. **Private Key** - Create for token signing (backend uses this)

## Notes

- First-time users: Apple returns user name in response
- Subsequent logins: Only email in ID token
- Backend persists user info on first signup
- State parameter differentiates signup vs login
  </document>
