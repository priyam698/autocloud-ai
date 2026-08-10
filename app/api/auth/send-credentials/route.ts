import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user_email, instanceId, access_password, instanceName } = body;

    if (!user_email || !access_password) {
      return NextResponse.json(
        { error: 'Missing user email or access password.' },
        { status: 400 }
      );
    }

    // Send styled email via Resend
    const emailResult = await resend.emails.send({
      from: 'AutoCloud AI <onboarding@resend.dev>', // Replace with your custom domain once verified
      to: [user_email],
      subject: '🚀 Your AutoCloud AI Agent Access Credentials',
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #090d16; color: #ffffff; padding: 30px; border-radius: 12px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #a855f7; margin-bottom: 10px;">Welcome to AutoCloud AI!</h2>
          <p style="color: #cbd5e1; font-size: 14px;">Your Telegram AI Agent instance has been deployed and is ready for configuration.</p>
          
          <hr style="border: 0; border-top: 1px solid #1e293b; margin: 20px 0;" />

          <div style="background-color: #0f172a; border: 1px solid #334155; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 5px 0; font-size: 13px; color: #94a3b8;"><strong>Agent Instance:</strong> <span style="color: #f8fafc;">${instanceName || 'Telegram AI Bot Runner'}</span></p>
            <p style="margin: 5px 0; font-size: 13px; color: #94a3b8;"><strong>Instance ID:</strong> <span style="color: #f8fafc; font-family: monospace;">${instanceId}</span></p>
            <p style="margin: 15px 0 5px 0; font-size: 14px; color: #a855f7;"><strong>🔑 Your Access Password:</strong></p>
            <div style="background-color: #1e1035; border: 1px dashed #a855f7; padding: 12px; text-align: center; border-radius: 6px; font-family: monospace; font-size: 18px; font-weight: bold; color: #c084fc; letter-spacing: 2px;">
              ${access_password}
            </div>
          </div>

          <p style="color: #cbd5e1; font-size: 13px; line-height: 1.5;">
            <strong>Next Steps:</strong><br />
            1. Visit your dashboard at <a href="https://autocloud-ai-p448.vercel.app/dashboard" style="color: #c084fc; text-decoration: underline;">AutoCloud AI Dashboard</a><br />
            2. Find your instance and click <strong>"🔒 Enter Password to Unlock"</strong>.<br />
            3. Paste the access password provided above to configure your Telegram Bot Token and Knowledge Base.
          </p>

          <hr style="border: 0; border-top: 1px solid #1e293b; margin: 20px 0;" />

          <p style="color: #64748b; font-size: 11px; text-align: center;">
            Need help? Contact support anytime at <a href="mailto:priyamrana069@gmail.com" style="color: #94a3b8;">priyamrana069@gmail.com</a>
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, data: emailResult });
  } catch (error: any) {
    console.error('[Send Credentials Email Error]:', error);
    return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 500 });
  }
}