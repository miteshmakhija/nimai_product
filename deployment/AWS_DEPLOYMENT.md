# NimAI — AWS Deployment Guide (nimai.ai)

## Option A — AWS Amplify (Recommended, Easiest)

### 1. Push to GitHub / CodeCommit
```bash
git init
git remote add origin https://github.com/your-org/nimai-site.git
git add .
git commit -m "Initial NimAI site"
git push -u origin main
```

### 2. Connect to AWS Amplify
1. Open **AWS Amplify Console** → *New app → Host web app*
2. Connect your Git repository and select the `main` branch
3. Amplify auto-detects the `amplify.yml` — build settings are pre-configured
4. Click **Save and deploy**

### 3. Attach Custom Domain (nimai.ai)
1. In Amplify → *App settings → Domain management*
2. Click **Add domain** → enter `nimai.ai`
3. Add subdomains: `www.nimai.ai` → root domain
4. Amplify provisions an ACM SSL certificate automatically
5. Update your domain registrar's name servers to the ones Amplify provides

---

## Option B — S3 + CloudFront (Full Control)

### 1. Build the app
```bash
npm run build
```

### 2. Create S3 bucket
```bash
aws s3 mb s3://nimai-ai-site --region us-east-1
aws s3 website s3://nimai-ai-site --index-document index.html --error-document index.html
```

### 3. Upload build artifacts
```bash
aws s3 sync build/ s3://nimai-ai-site --delete --cache-control "public,max-age=31536000,immutable"
aws s3 cp build/index.html s3://nimai-ai-site/index.html --cache-control "no-cache"
```

### 4. Create CloudFront distribution
```bash
aws cloudfront create-distribution \
  --origin-domain-name nimai-ai-site.s3-website-us-east-1.amazonaws.com \
  --default-root-object index.html
```

### 5. SSL Certificate (ACM)
1. Go to **AWS Certificate Manager** → *Request certificate*
2. Request for `nimai.ai` and `www.nimai.ai`
3. Validate via DNS — add CNAME records to your domain registrar
4. Attach the certificate to your CloudFront distribution

### 6. Route 53 DNS setup
```
Type: A (Alias)  Name: nimai.ai    → CloudFront distribution
Type: A (Alias)  Name: www.nimai.ai → CloudFront distribution
```

---

## Option C — AWS CDK (Infrastructure as Code)

See `infrastructure/` folder for a CDK stack that provisions S3 + CloudFront + ACM + Route53 automatically.

---

## Environment Variables

Create a `.env` file at the project root (never commit this):
```
REACT_APP_CONTACT_API=https://api.nimai.ai/contact
REACT_APP_GA_ID=G-XXXXXXXXXX
```

## CI/CD (GitHub Actions)

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to AWS Amplify
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      # Amplify auto-deploys on git push — no extra step needed
```
