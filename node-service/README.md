# Node Service Setup

If setting up on an EC2 instance, you need to install the dependencies including the Vercel CLI.

1. Ensure Node.js and npm are installed.
2. Run `npm install` inside this directory to install standard dependencies.
3. Install the Vercel CLI globally:
   ```bash
   npm install -g vercel
   ```
   (This is required by the `deployguard` backend to run deployments directly from the host.)
