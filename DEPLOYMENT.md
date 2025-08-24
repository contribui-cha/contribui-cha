# Deployment Guide

## Environment Variables

Before deploying, make sure to set up the following environment variables:

### Supabase
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

### Stripe
- `VITE_STRIPE_PUBLISHABLE_KEY`: Your Stripe publishable key

### Application
- `VITE_APP_URL`: Your application URL (for production)

## Local Development

1. Clone the repository
2. Copy `.env.example` to `.env`
3. Fill in your environment variables
4. Run `npm install`
5. Run `npm run dev`

## Production Deployment

### Vercel
1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy

### Netlify
1. Connect your GitHub repository to Netlify
2. Set environment variables in Netlify dashboard
3. Build command: `npm run build`
4. Publish directory: `dist`

## Database Setup

Make sure your Supabase database has the following tables and configurations:

1. Authentication enabled
2. Row Level Security (RLS) policies configured
3. Required tables created (events, guests, messages, etc.)
4. Storage buckets configured if using file uploads

## Stripe Setup

1. Create a Stripe account
2. Get your publishable key
3. Set up webhooks if needed
4. Configure payment methods
