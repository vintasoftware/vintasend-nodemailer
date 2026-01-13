import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';

import { BaseNotificationAdapter } from 'vintasend/dist/services/notification-adapters/base-notification-adapter';
import type { BaseEmailTemplateRenderer } from 'vintasend/dist/services/notification-template-renderers/base-email-template-renderer';
import type { JsonObject } from 'vintasend/dist/types/json-values';
import type { AnyDatabaseNotification } from 'vintasend/dist/types/notification';
import type { BaseNotificationTypeConfig } from 'vintasend/dist/types/notification-type-config';
import type { StoredAttachment } from 'vintasend/dist/types/attachment';

export class NodemailerNotificationAdapter<
  TemplateRenderer extends BaseEmailTemplateRenderer<Config>,
  Config extends BaseNotificationTypeConfig,
> extends BaseNotificationAdapter<TemplateRenderer, Config> {
  public key: string | null = 'nodemailer';
  private transporter: nodemailer.Transporter;

  constructor(
    templateRenderer: TemplateRenderer,
    enqueueNotifications: boolean,
    transportOptions: Parameters<typeof nodemailer.createTransport>[0],
  ) {
    super(templateRenderer, 'EMAIL', enqueueNotifications);
    this.transporter = nodemailer.createTransport(transportOptions);
  }

  get supportsAttachments(): boolean {
    return true;
  }

  async send(notification: AnyDatabaseNotification<Config>, context: JsonObject): Promise<void> {
    if (!this.backend) {
      throw new Error('Backend not injected');
    }

    const template = await this.templateRenderer.render(notification, context);

    if (!notification.id) {
      throw new Error('Notification ID is required');
    }

    // Use the helper method to get recipient email (handles both regular and one-off notifications)
    const recipientEmail = await this.getRecipientEmail(notification);

    const mailOptions: nodemailer.SendMailOptions = {
      to: recipientEmail,
      subject: template.subject,
      html: template.body,
    };

    // Add attachments if present
    if (notification.attachments && notification.attachments.length > 0) {
      mailOptions.attachments = await this.prepareAttachments(notification.attachments);
    }

    await this.transporter.sendMail(mailOptions);
  }

  protected async prepareAttachments(
    attachments: StoredAttachment[],
  ): Promise<Mail.Attachment[]> {
    return Promise.all(
      attachments.map(async (att) => ({
        filename: att.filename,
        content: await att.file.read(),
        contentType: att.contentType,
      }))
    );
  }
}

export class NodemailerNotificationAdapterFactory<Config extends BaseNotificationTypeConfig> {
  create<TemplateRenderer extends BaseEmailTemplateRenderer<Config>>(
    templateRenderer: TemplateRenderer,
    enqueueNotifications: boolean,
    transportOptions: Parameters<typeof nodemailer.createTransport>[0],
  ) {
    return new NodemailerNotificationAdapter<TemplateRenderer, Config>(
      templateRenderer,
      enqueueNotifications,
      transportOptions,
    );
  }
}
