import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import fs from "fs";
import type { Task, Invoice, Lead, User } from "@shared/schema";
import path from "path";

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  tls?: {
    rejectUnauthorized?: boolean;
  };
}

export class EmailService {
  private transporter: Transporter | null = null;
  private defaultFrom = "MaxTech BD <info@maxtechbd.com>";

  constructor() {
    // No auto initialization here. Call init() after envs are loaded.
  }

  private getFromAddress(): string {
    const smtpUser = (process.env.SMTP_USER || process.env.EMAIL_USER || "").trim();
    if (smtpUser) {
      return `MaxTech BD <${smtpUser}>`;
    }
    return this.defaultFrom;
  }

  private getEmailFooter(): string {
    return `
      <div style="background: #f3f4f6; padding: 20px; text-align: center; margin-top: 20px; border-top: 3px solid #C8102E;">
        <h3 style="color: #C8102E; margin: 0 0 10px 0;">MaxTech BD</h3>
        <p style="margin: 5px 0; font-size: 12px; color: #6b7280;">
          522, SK Mujib Road (4th Floor), Agrabad, Double Mooring<br>
          Chattogram, Bangladesh
        </p>
        <p style="margin: 5px 0; font-size: 12px; color: #6b7280;">
          Phone: +8801843180008 | Email: info@maxtechbd.com
        </p>
      </div>
    `;
  }

  /** Initialize transporter — call this after environment variables are loaded */
  public async init(): Promise<void> {
    const emailHost = (process.env.SMTP_HOST || process.env.EMAIL_HOST || "maxtechbd.com").trim();
    const emailPort = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || "465", 10);
    const emailUser = (process.env.SMTP_USER || process.env.EMAIL_USER || "").trim();
    const emailPass = process.env.SMTP_PASS || process.env.EMAIL_PASS || "";

    if (!emailUser || !emailPass) {
      console.warn("Email credentials not configured (SMTP_USER/SMTP_PASS). Email notifications disabled.");
      this.transporter = null;
      return;
    }

    const ignoreTls = process.env.SMTP_IGNORE_TLS === "true";

    const config: EmailConfig = {
      host: emailHost,
      port: emailPort,
      secure: emailPort === 465,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    };

    if (ignoreTls) {
      console.warn("SMTP_IGNORE_TLS=true — TLS certificate validation is DISABLED. Remove in production.");
      config.tls = { rejectUnauthorized: false };
    }

    try {
      console.log(`Attempting to create transporter for ${config.host}:${config.port} (secure=${config.secure}) as ${emailUser}`);
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.auth,
        tls: config.tls,
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
        logger: process.env.NODE_ENV !== "production",
        debug: process.env.NODE_ENV !== "production",
      });

      await this.transporter.verify();
      console.log(`Email service initialized and verified (from: ${emailUser})`);
    } catch (err: any) {
      console.error("Failed to verify SMTP connection:", err && err.message ? err.message : err);
      this.transporter = null;
    }
  }

  private async sendEmail(to: string | null, subject: string, html: string, attachments: any[] = []) {
    if (!to) {
      console.warn(`Email not sent: recipient address is null or empty (subject: ${subject})`);
      return false;
    }

    if (!this.transporter) {
      console.warn(`Email not sent to ${to}: transporter not configured`);
      return false;
    }

    try {
      try {
        const logEntry = `[${new Date().toISOString()}] [EMAIL SERVICE]\n` +
          `To: ${to}\n` +
          `Attachments Count: ${attachments?.length}\n` +
          `Attachments Raw: ${JSON.stringify(attachments)}\n\n`;
        fs.appendFileSync(path.join(process.cwd(), "debug_logs.txt"), logEntry);
      } catch (logErr) { console.error("Failed to write log", logErr); }

      console.log("[EMAIL SERVICE] sendEmail called for:", to);
      console.log("[EMAIL SERVICE] Attachments count:", attachments?.length);

      // Process attachments to point to local file system
      const processedAttachments = attachments.map(att => {
        // If url starts with /uploads, modify to point to local path
        if (att.url && att.url.startsWith('/uploads/')) {
          const localPath = path.join(process.cwd(), att.url);

          try {
            fs.appendFileSync(path.join(process.cwd(), "debug_logs.txt"),
              `[${new Date().toISOString()}] Processing Path: ${localPath}\nExists: ${fs.existsSync(localPath)}\n\n`);
          } catch (e) { }

          console.log(`[EMAIL SERVICE] Processing attachment: ${att.name}, URL: ${att.url} -> Path: ${localPath}`);
          return {
            filename: att.name,
            path: localPath
          };
        }
        console.log(`[EMAIL SERVICE] Processing attachment (raw URL): ${att.name}, URL: ${att.url}`);
        return {
          filename: att.name,
          path: att.url // Assuming absolute path if not /uploads
        };
      });

      const info = await this.transporter.sendMail({
        from: this.getFromAddress(),
        to,
        subject,
        html,
        attachments: processedAttachments
      });
      console.log(`Email sent to ${to}: messageId=${(info && (info as any).messageId) || "unknown"}`);
      return true;
    } catch (error: any) {
      console.error(`Failed to send email to ${to}:`, error && error.message ? error.message : error);
      if (process.env.NODE_ENV !== "production") {
        console.error(error);
      }
      return false;
    }
  }

  // ---------- Templates and public methods (full HTML preserved) ----------

  async sendTaskAssignment(task: Task & { project?: { name: string } }, assignee: User) {
    if (!assignee?.email) {
      console.warn("Cannot send task assignment: assignee email missing");
      return false;
    }

    const subject = `New Task Assigned: ${task.title}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #C8102E; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; }
          .task-details { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .label { font-weight: bold; color: #6b7280; }
          .button { display: inline-block; background: #C8102E; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Task Assigned</h1>
          </div>
          <div class="content">
            <p>Hi ${assignee.fullName},</p>
            <p>You have been assigned a new task:</p>
            
            <div class="task-details">
              <p><span class="label">Task:</span> ${task.title}</p>
              ${task.description ? `<p><span class="label">Description:</span> ${task.description}</p>` : ''}
              ${task.project ? `<p><span class="label">Project:</span> ${task.project.name}</p>` : ''}
              ${task.priority ? `<p><span class="label">Priority:</span> ${String(task.priority).toUpperCase()}</p>` : ''}
              ${task.deadline ? `<p><span class="label">Deadline:</span> ${new Date(task.deadline).toLocaleDateString()}</p>` : ''}
            </div>
            
            <a href="${process.env.APP_URL || 'http://localhost:5000'}/tasks" class="button">View Task</a>
            
            ${this.getEmailFooter()}
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(assignee.email, subject, html);
  }

  async sendInvoiceReminder(invoice: Invoice & { client?: { name: string; email: string } }) {
    if (!invoice.client?.email) {
      console.warn("Cannot send invoice reminder: client information missing or email missing");
      return false;
    }

    const daysUntilDue = Math.ceil(
      (new Date(invoice.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    const subject = daysUntilDue < 0
      ? `Overdue Invoice Reminder - ${invoice.invoiceNumber}`
      : `Invoice Due Soon - ${invoice.invoiceNumber}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${daysUntilDue < 0 ? '#dc2626' : '#C8102E'}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; }
          .invoice-details { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .label { font-weight: bold; color: #6b7280; }
          .amount { font-size: 24px; font-weight: bold; color: ${daysUntilDue < 0 ? '#dc2626' : '#C8102E'}; }
          .button { display: inline-block; background: #C8102E; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${daysUntilDue < 0 ? 'Overdue Invoice' : 'Invoice Reminder'}</h1>
          </div>
          <div class="content">
            <p>Dear ${invoice.client.name},</p>
            <p>${daysUntilDue < 0
        ? 'This is a reminder that the following invoice is overdue:'
        : `Your invoice is due ${daysUntilDue === 0 ? 'today' : `in ${daysUntilDue} days`}:`
      }</p>
            
            <div class="invoice-details">
              <p><span class="label">Invoice Number:</span> ${invoice.invoiceNumber}</p>
              <p><span class="label">Amount:</span> <span class="amount">${Number(invoice.amount).toLocaleString()}</span></p>
              <p><span class="label">Due Date:</span> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
              ${invoice.notes ? `<p><span class="label">Notes:</span> ${invoice.notes}</p>` : ''}
            </div>
            
            <p>Please arrange payment at your earliest convenience.</p>
            
            <a href="${process.env.APP_URL || 'http://localhost:5000'}/invoices" class="button">View Invoice</a>
            
            ${this.getEmailFooter()}
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(invoice.client.email, subject, html);
  }

  async sendLeadFollowUp(lead: Lead & { assignedUser?: User }) {
    if (!lead.assignedUser?.email) {
      console.warn("Cannot send lead follow-up: assignee information missing or email missing");
      return false;
    }

    const subject = `Lead Follow-up Reminder: ${lead.name}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #C8102E; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; }
          .lead-details { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .label { font-weight: bold; color: #6b7280; }
          .button { display: inline-block; background: #C8102E; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Lead Follow-up Reminder</h1>
          </div>
          <div class="content">
            <p>Hi ${lead.assignedUser.fullName},</p>
            <p>It's time to follow up with this lead:</p>
            
            <div class="lead-details">
              <p><span class="label">Name:</span> ${lead.name}</p>
              <p><span class="label">Email:</span> ${lead.email ?? "N/A"}</p>
              ${lead.phone ? `<p><span class="label">Phone:</span> ${lead.phone}</p>` : ''}
              <p><span class="label">Status:</span> ${lead.status?.toUpperCase?.() ?? lead.status}</p>
              ${lead.source ? `<p><span class="label">Source:</span> ${lead.source}</p>` : ''}
              ${lead.notes ? `<p><span class="label">Notes:</span> ${lead.notes}</p>` : ''}
            </div>
            
            <a href="${process.env.APP_URL || 'http://localhost:5000'}/leads" class="button">View Lead</a>
            
            ${this.getEmailFooter()}
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(lead.assignedUser.email, subject, html);
  }

  async sendWelcomeEmail(user: User) {
    if (!user?.email) {
      console.warn("Cannot send welcome email: user email missing");
      return false;
    }

    const subject = "Welcome to MaxTech BD";
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #C8102E; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 20px; }
          .button { display: inline-block; background: #C8102E; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to MaxTech BD!</h1>
          </div>
          <div class="content">
            <p>Hi ${user.fullName},</p>
            <p>Welcome to MaxTech BD Agency Management System! Your account has been created successfully.</p>
            
            <p><strong>Your account details:</strong></p>
            <ul>
              <li>Email: ${user.email}</li>
              <li>Role: ${user.role}</li>
            </ul>
            
            <p>You can now log in and start managing your agency operations efficiently.</p>
            
            <a href="${process.env.APP_URL || 'http://localhost:5000'}/login" class="button">Log In Now</a>
            
            <p style="margin-top: 20px;">
              If you have any questions, feel free to reach out to our support team.
            </p>
            
            ${this.getEmailFooter()}
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(user.email, subject, html);
  }

  async sendLeadServiceIntroduction(lead: Lead): Promise<boolean> {
    if (!lead?.email) {
      console.warn("Cannot send service introduction: lead email missing");
      return false;
    }

    const subject = "Discover Our Premium Digital Services - MaxTech BD";
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.8; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
          .header { background: linear-gradient(135deg, #C8102E 0%, #8B0000 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { padding: 30px; background: #f9fafb; }
          .service-box { background: white; border-radius: 8px; padding: 20px; margin: 15px 0; border-left: 4px solid #C8102E; }
          .service-box h3 { color: #C8102E; margin: 0 0 10px 0; }
          .cta-button { display: inline-block; background: #C8102E; color: white; padding: 14px 28px; 
                       text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
          .whatsapp-btn { display: inline-block; background: #25D366; color: white; padding: 14px 28px; 
                         text-decoration: none; border-radius: 6px; margin: 10px 0; font-weight: bold; }
          .contact-info { background: #1f2937; color: white; padding: 20px; margin-top: 20px; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to MaxTech BD</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Your Partner in Digital Excellence</p>
          </div>
          <div class="content">
            <p>Dear ${lead.name},</p>
            <p>Thank you for your interest in MaxTech BD! We are a leading digital agency based in Bangladesh, specializing in delivering world-class solutions to businesses worldwide.</p>
            
            <h2 style="color: #C8102E;">Our Services</h2>
            
            <div class="service-box">
              <h3>Web Development</h3>
              <p>Custom websites, e-commerce platforms, web applications using React, Node.js, and modern technologies.</p>
            </div>
            
            <div class="service-box">
              <h3>Mobile App Development</h3>
              <p>Native and cross-platform mobile applications for iOS and Android.</p>
            </div>
            
            <div class="service-box">
              <h3>UI/UX Design</h3>
              <p>User-centered design, wireframing, prototyping, and brand identity design.</p>
            </div>
            
            <div class="service-box">
              <h3>Digital Marketing</h3>
              <p>SEO, social media marketing, content marketing, and PPC campaigns.</p>
            </div>
            
            <div class="service-box">
              <h3>Custom Software Solutions</h3>
              <p>Tailored business solutions, CRM systems, and enterprise applications.</p>
            </div>
            
            <p style="text-align: center; margin-top: 30px;">
              <a href="https://wa.me/8801843180008" class="whatsapp-btn">Chat on WhatsApp</a>
            </p>
            
            <div class="contact-info">
              <h3 style="margin: 0 0 15px 0; color: #C8102E;">Get in Touch</h3>
              <p style="margin: 5px 0;">Phone: +8801843180008</p>
              <p style="margin: 5px 0;">Email: info@maxtechbd.com</p>
              <p style="margin: 5px 0;">Address: 522, SK Mujib Road (4th Floor), Agrabad, Chattogram</p>
            </div>
            
            ${this.getEmailFooter()}
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(lead.email, subject, html);
  }

  async sendLeadCompanyProfile(lead: Lead): Promise<boolean> {
    if (!lead?.email) {
      console.warn("Cannot send company profile: lead email missing");
      return false;
    }

    const subject = "About MaxTech BD - Your Trusted Technology Partner";
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.8; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
          .header { background: linear-gradient(135deg, #C8102E 0%, #8B0000 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; background: #f9fafb; }
          .highlight-box { background: white; border-radius: 8px; padding: 20px; margin: 15px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
          .stat-item { background: #C8102E; color: white; padding: 20px; border-radius: 8px; text-align: center; }
          .stat-number { font-size: 28px; font-weight: bold; }
          .whatsapp-btn { display: inline-block; background: #25D366; color: white; padding: 14px 28px; 
                         text-decoration: none; border-radius: 6px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>MaxTech BD</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Smart Agency Control Hub</p>
          </div>
          <div class="content">
            <p>Dear ${lead.name},</p>
            
            <h2 style="color: #C8102E;">Who We Are</h2>
            <p>MaxTech BD is a premier digital agency headquartered in Chattogram, Bangladesh. We specialize in delivering innovative technology solutions to businesses worldwide, helping them achieve their digital transformation goals.</p>
            
            <div class="highlight-box">
              <h3 style="color: #C8102E; margin-top: 0;">Our Mission</h3>
              <p>To empower businesses with cutting-edge technology solutions that drive growth, efficiency, and success in the digital age.</p>
            </div>
            
            <div class="stat-grid">
              <div class="stat-item">
                <div class="stat-number">100+</div>
                <div>Projects Delivered</div>
              </div>
              <div class="stat-item">
                <div class="stat-number">50+</div>
                <div>Happy Clients</div>
              </div>
              <div class="stat-item">
                <div class="stat-number">5+</div>
                <div>Years Experience</div>
              </div>
              <div class="stat-item">
                <div class="stat-number">24/7</div>
                <div>Support Available</div>
              </div>
            </div>
            
            <div class="highlight-box">
              <h3 style="color: #C8102E; margin-top: 0;">Why Choose Us?</h3>
              <ul>
                <li>Experienced team of developers and designers</li>
                <li>Competitive pricing with quality assurance</li>
                <li>Timely delivery and transparent communication</li>
                <li>Post-delivery support and maintenance</li>
                <li>Global client base with local expertise</li>
              </ul>
            </div>
            
            <p style="text-align: center; margin-top: 30px;">
              <a href="https://wa.me/8801843180008" class="whatsapp-btn">Schedule a Meeting</a>
            </p>
            
            ${this.getEmailFooter()}
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(lead.email, subject, html);
  }

  async sendLeadPricingBrochure(lead: Lead): Promise<boolean> {
    if (!lead?.email) {
      console.warn("Cannot send pricing brochure: lead email missing");
      return false;
    }

    const subject = "MaxTech BD - Service Pricing & Packages";
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.8; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
          .header { background: linear-gradient(135deg, #C8102E 0%, #8B0000 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; background: #f9fafb; }
          .pricing-card { background: white; border-radius: 8px; padding: 25px; margin: 15px 0; border: 2px solid #e5e7eb; text-align: center; }
          .pricing-card.featured { border-color: #C8102E; }
          .pricing-title { color: #C8102E; font-size: 20px; font-weight: bold; margin-bottom: 10px; }
          .pricing-price { font-size: 32px; font-weight: bold; color: #1f2937; }
          .pricing-features { text-align: left; margin: 20px 0; }
          .pricing-features li { padding: 5px 0; }
          .cta-button { display: inline-block; background: #C8102E; color: white; padding: 12px 24px; 
                       text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 15px; }
          .whatsapp-btn { display: inline-block; background: #25D366; color: white; padding: 14px 28px; 
                         text-decoration: none; border-radius: 6px; font-weight: bold; }
          .note { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Our Pricing Plans</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Flexible Solutions for Every Budget</p>
          </div>
          <div class="content">
            <p>Dear ${lead.name},</p>
            <p>Thank you for your interest in our services. Here are our competitive pricing packages:</p>
            
            <div class="pricing-card">
              <div class="pricing-title">Basic Website</div>
              <div class="pricing-price">From $299</div>
              <ul class="pricing-features">
                <li>5-7 Pages Responsive Website</li>
                <li>Modern UI/UX Design</li>
                <li>Contact Form Integration</li>
                <li>SEO Optimized</li>
                <li>1 Month Free Support</li>
              </ul>
              <a href="https://wa.me/8801843180008?text=Hi, I'm interested in Basic Website package" class="cta-button">Get Started</a>
            </div>
            
            <div class="pricing-card featured">
              <div class="pricing-title">E-Commerce Solution</div>
              <div class="pricing-price">From $799</div>
              <ul class="pricing-features">
                <li>Full E-Commerce Functionality</li>
                <li>Payment Gateway Integration</li>
                <li>Product Management System</li>
                <li>Order Tracking</li>
                <li>3 Months Free Support</li>
              </ul>
              <a href="https://wa.me/8801843180008?text=Hi, I'm interested in E-Commerce Solution" class="cta-button">Get Started</a>
            </div>
            
            <div class="pricing-card">
              <div class="pricing-title">Custom Software</div>
              <div class="pricing-price">Custom Quote</div>
              <ul class="pricing-features">
                <li>Tailored Business Solutions</li>
                <li>CRM/ERP Systems</li>
                <li>API Integrations</li>
                <li>Scalable Architecture</li>
                <li>Ongoing Maintenance</li>
              </ul>
              <a href="https://wa.me/8801843180008?text=Hi, I need a custom software solution" class="cta-button">Request Quote</a>
            </div>
            
            <div class="note">
              <strong>Note:</strong> All prices are starting prices. Final cost depends on specific requirements and project scope. Contact us for a detailed quote tailored to your needs.
            </div>
            
            <p style="text-align: center; margin-top: 30px;">
              <a href="https://wa.me/8801843180008" class="whatsapp-btn">Discuss Your Project</a>
            </p>
            
            ${this.getEmailFooter()}
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(lead.email, subject, html);
  }

  async sendLeadFollowUpEmail(lead: Lead): Promise<boolean> {
    if (!lead?.email) {
      console.warn("Cannot send follow-up email: lead email missing");
      return false;
    }

    const subject = "Following Up - How Can We Help You? - MaxTech BD";
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.8; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
          .header { background: linear-gradient(135deg, #C8102E 0%, #8B0000 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; background: #f9fafb; }
          .cta-box { background: white; border-radius: 8px; padding: 25px; margin: 20px 0; text-align: center; border: 2px solid #C8102E; }
          .whatsapp-btn { display: inline-block; background: #25D366; color: white; padding: 14px 28px; 
                         text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px; }
          .email-btn { display: inline-block; background: #C8102E; color: white; padding: 14px 28px; 
                      text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>We'd Love to Hear From You!</h1>
          </div>
          <div class="content">
            <p>Dear ${lead.name},</p>
            
            <p>We hope this email finds you well! We recently reached out about our digital services and wanted to follow up to see if you have any questions.</p>
            
            <p>At MaxTech BD, we understand that choosing the right technology partner is an important decision. We're here to help answer any questions you might have about:</p>
            
            <ul>
              <li>Our services and capabilities</li>
              <li>Pricing and project timelines</li>
              <li>Our development process</li>
              <li>Past projects and case studies</li>
            </ul>
            
            <div class="cta-box">
              <h3 style="color: #C8102E; margin-top: 0;">Ready to Start Your Project?</h3>
              <p>Let's discuss how we can help bring your ideas to life!</p>
              <a href="https://wa.me/8801843180008" class="whatsapp-btn">WhatsApp Us</a>
              <a href="mailto:info@maxtechbd.com" class="email-btn">Email Us</a>
            </div>
            
            <p>If you're not ready to move forward just yet, no problem at all! Feel free to keep our information on file for when the time is right.</p>
            
            <p>We look forward to the opportunity to work with you!</p>
            
            <p>Best regards,<br><strong>The MaxTech BD Team</strong></p>
            
            ${this.getEmailFooter()}
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(lead.email, subject, html);
  }

  getTemplateSubject(templateName: string): string {
    const subjects: Record<string, string> = {
      service_introduction: "Discover Our Premium Digital Services - MaxTech BD",
      company_profile: "About MaxTech BD - Your Trusted Technology Partner",
      pricing_brochure: "MaxTech BD - Service Pricing & Packages",
      follow_up_reminder: "Following Up - How Can We Help You? - MaxTech BD",
    };
    return subjects[templateName] || "Message from MaxTech BD";
  }

  async sendLeadTemplateEmail(lead: Lead, templateName: string): Promise<boolean> {
    switch (templateName) {
      case "service_introduction":
        return this.sendLeadServiceIntroduction(lead);
      case "company_profile":
        return this.sendLeadCompanyProfile(lead);
      case "pricing_brochure":
        return this.sendLeadPricingBrochure(lead);
      case "follow_up_reminder":
        return this.sendLeadFollowUpEmail(lead);
      default:
        console.warn(`Unknown template: ${templateName}`);
        return false;
    }
  }

  async sendCustomEmail(lead: Lead, template: { subject: string; message: string; attachments?: any[] }, sender?: User | null): Promise<boolean> {
    if (!lead?.email) {
      console.warn("Cannot send custom email: lead email missing");
      return false;
    }

    let subject = template.subject;
    let messageBody = template.message;

    // Variable substitution
    const vars: Record<string, string> = {
      "{{lead.name}}": lead.name,
      "{{lead.email}}": lead.email || "",
      "{{lead.phone}}": lead.phone || "",
      "{{user.name}}": sender?.fullName || "The Team",
      "{{user.email}}": sender?.email || "info@maxtechbd.com"
    };

    for (const key of Object.keys(vars)) {
      const val = vars[key];
      // Global replace using regex
      subject = subject.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), val);
      messageBody = messageBody.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), val);
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #C8102E; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 20px; }
          .message-body { white-space: pre-wrap; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="font-size: 20px; margin: 0;">${subject}</h1>
          </div>
          <div class="content">
            <div class="message-body">${messageBody}</div>
            
            ${this.getEmailFooter()}
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(lead.email, subject, html, template.attachments || []);
  }

  isConfigured(): boolean {
    return this.transporter !== null;
  }
}

/** Factory helper — call this after dotenv/config is loaded */
export async function createEmailService(): Promise<EmailService> {
  const svc = new EmailService();
  await svc.init();
  return svc;
}
