# Cloudflare R2 for English Tech

English Tech keeps accounts, authentication, permissions, progress, and file metadata in Supabase. The actual videos and assignment documents live in a private Cloudflare R2 bucket.

## Required R2 resources

- Private bucket: `english-tech-private`
- Standard storage class
- Public development URL: disabled
- Custom domain: not required
- CORS configuration: use `deploy/s3-cors.json`
- API token permissions: Object Read & Write for this bucket only

## Vercel environment variables

Set these for Production and Preview:

```text
S3_BUCKET=english-tech-private
S3_REGION=auto
S3_ENDPOINT=https://<CLOUDFLARE_ACCOUNT_ID>.r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID=<R2_ACCESS_KEY_ID>
AWS_SECRET_ACCESS_KEY=<R2_SECRET_ACCESS_KEY>
VIDEO_UPLOAD_MAX_MB=2048
INLINE_UPLOAD_VALIDATION=true
```

Keep the bucket private. The browser receives a ten-minute signed PUT URL only after the English Tech API authenticates the user and validates the declared file type and size. File records remain in Supabase. Approved objects are stored under `media/`; incomplete uploads remain under `quarantine/` and should be removed with a lifecycle rule after 24 hours.

Never commit the access key or secret key. Rotate the R2 token immediately if either value is exposed.
