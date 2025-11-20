# SSL Certificate Setup

This directory is for storing SSL certificates for HTTPS support.

## Self-Signed Certificates (Development/Testing)

To generate self-signed certificates for testing:

```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem \
  -out cert.pem \
  -subj "/C=PK/ST=Punjab/L=Lahore/O=Digiskills/CN=monitor.digiskills.local"
```

## Let's Encrypt Certificates (Production)

For production environments, use Let's Encrypt for free SSL certificates:

### Option 1: Using Certbot

```bash
# Install Certbot
sudo apt-get update
sudo apt-get install certbot

# Generate certificate (HTTP-01 challenge)
sudo certbot certonly --standalone \
  -d monitor.digiskills.local \
  --email admin@digiskills.local \
  --agree-tos

# Copy certificates to this directory
sudo cp /etc/letsencrypt/live/monitor.digiskills.local/fullchain.pem ./cert.pem
sudo cp /etc/letsencrypt/live/monitor.digiskills.local/privkey.pem ./key.pem
```

### Option 2: Using Docker with Certbot

```bash
# Run Certbot in Docker
docker run -it --rm \
  -v ./nginx/ssl:/etc/letsencrypt \
  certbot/certbot certonly --standalone \
  -d monitor.digiskills.local \
  --email admin@digiskills.local \
  --agree-tos
```

## Certificate Renewal

Let's Encrypt certificates expire after 90 days. Set up automatic renewal:

```bash
# Add to crontab (runs daily at 2 AM)
0 2 * * * certbot renew --quiet && docker-compose restart nginx
```

## Using Certificates with Nginx

1. Place your certificates in this directory:
   - `cert.pem` - Certificate file
   - `key.pem` - Private key file

2. Uncomment the HTTPS server block in `nginx/conf.d/default.conf`

3. Update `.env.production`:
   ```env
   ENABLE_HTTPS=true
   SSL_CERT_PATH=/etc/nginx/ssl/cert.pem
   SSL_KEY_PATH=/etc/nginx/ssl/key.pem
   ```

4. Restart Nginx:
   ```bash
   docker-compose restart nginx
   ```

## File Permissions

Ensure proper permissions for security:

```bash
chmod 600 key.pem
chmod 644 cert.pem
```

## Testing HTTPS

After setup, test your HTTPS configuration:

```bash
# Check certificate
openssl s_client -connect monitor.digiskills.local:443 -servername monitor.digiskills.local

# Test SSL/TLS
curl -I https://monitor.digiskills.local

# Check SSL rating (requires public domain)
https://www.ssllabs.com/ssltest/
```

## Security Best Practices

1. **Never commit private keys to version control**
2. Use strong encryption (RSA 2048-bit minimum)
3. Enable HSTS headers (configured in nginx)
4. Use modern TLS protocols only (TLS 1.2+)
5. Regular certificate renewal
6. Monitor certificate expiration

## Troubleshooting

### Certificate Not Trusted
- For self-signed certificates, you'll need to add them to your browser/system trust store
- For Let's Encrypt, ensure your domain is publicly accessible

### Permission Denied
```bash
sudo chown -R 1000:1000 ./nginx/ssl
chmod 600 key.pem
```

### Nginx Won't Start
- Check certificate paths in nginx config
- Verify certificate and key match
- Check nginx error logs: `docker-compose logs nginx`

## Resources

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [Nginx SSL Configuration](https://nginx.org/en/docs/http/configuring_https_servers.html)
