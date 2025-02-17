import nodemailer from 'nodemailer';

import type { BaseNotificationAdapter } from 'vintasend/src/services/notification-adapters/base-notification-adapter';
import type { BaseEmailTemplateRenderer } from 'vintasend/src/services/notification-template-renderers/base-email-template-renderer';
import type { BaseNotificationBackend } from 'vintasend/src/services/notification-backends/base-notification-backend';
import type { Notification } from 'vintasend/src/types/notification';
import type { JsonObject } from 'vintasend/src/types/json-values';
import type { NotificationType } from 'vintasend/src/types/notification-type';
import type { ContextGenerator } from 'vintasend/src/services/notification-context-registry';
import type { Identifier } from 'vintasend/src/types/identifier';

export class NodemailerNotificationAdapter<
  TemplateRenderer extends BaseEmailTemplateRenderer<AvailableContexts>,
  Backend extends BaseNotificationBackend<AvailableContexts>,
  AvailableContexts extends Record<string, ContextGenerator>,
  NotificationIdType extends Identifier = Identifier,
  UserIdType extends Identifier = Identifier,
> implements
    BaseNotificationAdapter<
      TemplateRenderer,
      Backend,
      AvailableContexts,
      NotificationIdType,
      UserIdType
    >
{
  private transporter: nodemailer.Transporter;
  public readonly notificationType: NotificationType = 'EMAIL';
  public readonly key = 'nodemailer';

  constructor(
    public templateRenderer: TemplateRenderer,
    public backend: Backend,
    public readonly enqueueNotifications: boolean,
    transportOptions: Parameters<typeof nodemailer.createTransport>[0],
  ) {
    this.transporter = nodemailer.createTransport(transportOptions);
  }

  async send(
    notification: Notification<AvailableContexts, NotificationIdType, UserIdType>,
    context: JsonObject,
  ): Promise<void> {
    const template = await this.templateRenderer.render(notification, context);

    if (!notification.id) {
      throw new Error('Notification ID is required');
    }

    const userEmail = await this.backend.getUserEmailFromNotification(notification.id);

    if (!userEmail) {
      throw new Error('User email not found');
    }

    const mailOptions: nodemailer.SendMailOptions = {
      to: userEmail,
      subject: template.subject,
      html: template.body,
    };

    await this.transporter.sendMail(mailOptions);
  }
}
