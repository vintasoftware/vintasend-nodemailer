import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import type { BaseNotificationBackend } from 'vintasend/dist/services/notification-backends/base-notification-backend';
import type { BaseEmailTemplateRenderer } from 'vintasend/dist/services/notification-template-renderers/base-email-template-renderer';
import type { DatabaseNotification } from 'vintasend/dist/types/notification';
import { vi, type Mocked } from 'vitest';
import { NodemailerNotificationAdapterFactory } from '../index';

vi.mock('nodemailer');

describe('NodemailerNotificationAdapter', () => {
  const mockTransporter = {
    sendMail: vi.fn(),
  };

  const mockTemplateRenderer = {
    render: vi.fn(),
    renderFromTemplateContent: vi.fn(),
    // biome-ignore lint/suspicious/noExplicitAny: any just for testing
  } as Mocked<BaseEmailTemplateRenderer<any>>;

  // biome-ignore lint/suspicious/noExplicitAny: any just for testing
  const mockBackend: Mocked<BaseNotificationBackend<any>> = {
    persistNotification: vi.fn(),
    persistNotificationUpdate: vi.fn(),
    getAllFutureNotifications: vi.fn(),
    getAllFutureNotificationsFromUser: vi.fn(),
    getFutureNotificationsFromUser: vi.fn(),
    getFutureNotifications: vi.fn(),
    getAllPendingNotifications: vi.fn(),
    getPendingNotifications: vi.fn(),
    getNotification: vi.fn(),
    markAsRead: vi.fn(),
    filterAllInAppUnreadNotifications: vi.fn(),
    cancelNotification: vi.fn(),
    markAsSent: vi.fn(),
    markAsFailed: vi.fn(),
    storeAdapterAndContextUsed: vi.fn(),
    getUserEmailFromNotification: vi.fn(),
    filterInAppUnreadNotifications: vi.fn(),
    bulkPersistNotifications: vi.fn(),
    getAllNotifications: vi.fn(),
    getNotifications: vi.fn(),
    persistOneOffNotification: vi.fn(),
    persistOneOffNotificationUpdate: vi.fn(),
    getOneOffNotification: vi.fn(),
    getAllOneOffNotifications: vi.fn(),
    getOneOffNotifications: vi.fn(),
    getAttachmentFile: vi.fn(),
    deleteAttachmentFile: vi.fn(),
    getOrphanedAttachmentFiles: vi.fn(),
    getAttachments: vi.fn(),
    deleteNotificationAttachment: vi.fn(),
    findAttachmentFileByChecksum: vi.fn(),
    filterNotifications: vi.fn(),
  };

  // biome-ignore lint/suspicious/noExplicitAny: any just for testing
  let mockNotification: DatabaseNotification<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(nodemailer.createTransport).mockReturnValue(mockTransporter as any);
    mockNotification = {
      id: '123',
      notificationType: 'EMAIL' as const,
      contextName: 'testContext',
      contextParameters: {},
      userId: '456',
      title: 'Test Notification',
      bodyTemplate: '/path/to/template',
      subjectTemplate: '/path/to/subject',
      extraParams: {},
      contextUsed: null,
      adapterUsed: null,
      status: 'PENDING_SEND' as const,
      sentAt: null,
      readAt: null,
      gitCommitSha: null,
      sendAfter: new Date(),
    };
  });

  it('should initialize with correct properties', () => {
    const adapter = new NodemailerNotificationAdapterFactory().create(mockTemplateRenderer, false, {
      host: 'smtp.example.com',
      port: 587,
      secure: false, // true for port 465, false for other ports
      auth: {
        user: 'username',
        pass: 'password',
      },
    } as SMTPTransport.Options);

    expect(adapter.notificationType).toBe('EMAIL');
    expect(adapter.key).toBe('nodemailer');
    expect(adapter.enqueueNotifications).toBe(false);
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false, // true for port 465, false for other ports
      auth: {
        user: 'username',
        pass: 'password',
      },
    } as SMTPTransport.Options);
  });

  it('should send email successfully', async () => {
    const adapter = new NodemailerNotificationAdapterFactory().create(mockTemplateRenderer, false, {
      host: 'smtp.example.com',
      port: 587,
      secure: false, // true for port 465, false for other ports
      auth: {
        user: 'username',
        pass: 'password',
      },
    } as SMTPTransport.Options);
    adapter.injectBackend(mockBackend);

    const context = { foo: 'bar' };
    const renderedTemplate = {
      subject: 'Test Subject',
      body: '<p>Test Body</p>',
    };
    const userEmail = 'user@example.com';

    mockTemplateRenderer.render.mockResolvedValue(renderedTemplate);
    mockBackend.getUserEmailFromNotification.mockResolvedValue(userEmail);

    await adapter.send(mockNotification, context);

    expect(mockTemplateRenderer.render).toHaveBeenCalledWith(mockNotification, context);
    expect(mockBackend.getUserEmailFromNotification).toHaveBeenCalledWith('123');
    expect(mockTransporter.sendMail).toHaveBeenCalledWith({
      to: userEmail,
      subject: renderedTemplate.subject,
      html: renderedTemplate.body,
    });
  });

  it('should throw error if notification ID is missing', async () => {
    const adapter = new NodemailerNotificationAdapterFactory().create(mockTemplateRenderer, false, {
      host: 'smtp.example.com',
      port: 587,
      secure: false, // true for port 465, false for other ports
      auth: {
        user: 'username',
        pass: 'password',
      },
    } as SMTPTransport.Options);
    adapter.injectBackend(mockBackend);

    mockNotification.id = undefined;

    await expect(adapter.send(mockNotification, {})).rejects.toThrow('Notification ID is required');
  });

  it('should throw error if backend not injected', async () => {
    const adapter = new NodemailerNotificationAdapterFactory().create(mockTemplateRenderer, false, {
      host: 'smtp.example.com',
      port: 587,
      secure: false, // true for port 465, false for other ports
      auth: {
        user: 'username',
        pass: 'password',
      },
    } as SMTPTransport.Options);

    mockNotification.id = '123';

    await expect(adapter.send(mockNotification, {})).rejects.toThrow('Backend not injected');
  });

  it('should throw error if user email is not found', async () => {
    const adapter = new NodemailerNotificationAdapterFactory().create(mockTemplateRenderer, false, {
      host: 'smtp.example.com',
      port: 587,
      secure: false, // true for port 465, false for other ports
      auth: {
        user: 'username',
        pass: 'password',
      },
    } as SMTPTransport.Options);
    adapter.injectBackend(mockBackend);

    mockTemplateRenderer.render.mockResolvedValue({
      subject: 'Test Subject',
      body: '<p>Test Body</p>',
    });
    mockBackend.getUserEmailFromNotification.mockResolvedValue(undefined);

    await expect(adapter.send(mockNotification, {})).rejects.toThrow('User email not found');
  });
});
