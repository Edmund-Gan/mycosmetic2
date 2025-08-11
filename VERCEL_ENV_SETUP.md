# Vercel Environment Variables Setup Guide

## Required Environment Variables

You must set these environment variables in your Vercel dashboard for the deployment to work:

### 1. DATABASE_URL (Required)
Your PostgreSQL database connection string from Neon or your database provider.

**Format:**
```
postgresql://username:password@host:port/database?sslmode=require
```

**Example:**
```
postgresql://myuser:mypassword@ep-cool-darkness-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
```

**Important:** 
- Must include `?sslmode=require` at the end for secure connections
- Get this from your Neon dashboard under "Connection Details"

### 2. NODE_ENV (Required)
Set this to `production`

```
NODE_ENV=production
```

## How to Add Environment Variables in Vercel

1. Go to your Vercel dashboard
2. Select your project
3. Click on "Settings" tab
4. Navigate to "Environment Variables" in the left sidebar
5. Add each variable:
   - Click "Add New"
   - Enter the Key (e.g., `DATABASE_URL`)
   - Enter the Value (your connection string)
   - Select environments (Production, Preview, Development)
   - Click "Save"

## Verification Steps

After setting the environment variables:

1. Trigger a new deployment (push a commit or click "Redeploy")
2. Check the Function logs in Vercel dashboard
3. Test the API endpoint: `https://your-project.vercel.app/api/health`
4. You should see: `{"status":"OK","message":"CosmeticGuard API is running"}`

## Troubleshooting

If you still see DATABASE_URL errors:

1. **Check the variable name:** Must be exactly `DATABASE_URL` (all caps)
2. **Check the connection string:** Ensure it includes `?sslmode=require`
3. **Check Vercel logs:** Go to Functions tab → View logs
4. **Test locally:** Your local `.env` file should have the same DATABASE_URL for testing

## Security Note

- Never commit `.env` files to git
- Always use Vercel dashboard for production environment variables
- Keep your database credentials secure