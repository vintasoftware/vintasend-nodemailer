import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import type { BaseNotificationBackend } from 'vintasend/dist/services/notification-backends/base-notification-backend';
import type { BaseEmailTemplateRenderer } from 'vintasend/dist/services/notification-template-renderers/base-email-template-renderer';
import type { DatabaseNotification } from 'vintasend/dist/types/notification';
import type { StoredAttachment, AttachmentFile } from 'vintasend/dist/types/attachment';
import { NodemailerNotificationAdapterFactory } from '../index';

jest.mock('nodemailer');

describe('NodemailerNotificationAdapter - Attachments', () => {
  const mockTransporter = {
    sendMail: jest.fn(),
  };

  const mockTemplateRenderer = {
    render: jest.fn(),
    // biome-ignore lint/suspicious/noExplicitAny: any just for testing
  } as jest.Mocked<BaseEmailTemplateRenderer<any>>;

  // biome-ignore lint/suspicious/noExplicitAny: any just for testing
  const mockBackend: jest.Mocked<BaseNotificationBackend<any>> = {
    persistNotification: jest.fn(),
    persistNotificationUpdate: jest.fn(),
    getAllFutureNotifications: jest.fn(),
    getAllFutureNotificationsFromUser: jest.fn(),
    getFutureNotificationsFromUser: jest.fn(),
    getFutureNotifications: jest.fn(),
    getAllPendingNotifications: jest.fn(),
    getPendingNotifications: jest.fn(),
    getNotification: jest.fn(),
    markAsRead: jest.fn(),
    filterAllInAppUnreadNotifications: jest.fn(),
    cancelNotification: jest.fn(),
    markAsSent: jest.fn(),
    markAsFailed: jest.fn(),
    storeAdapterAndContextUsed: jest.fn(),
    getUserEmailFromNotification: jest.fn(),
    filterInAppUnreadNotifications: jest.fn(),
    bulkPersistNotifications: jest.fn(),
    getAllNotifications: jest.fn(),
    getNotifications: jest.fn(),
    persistOneOffNotification: jest.fn(),
    persistOneOffNotificationUpdate: jest.fn(),
    getOneOffNotification: jest.fn(),
    getAllOneOffNotifications: jest.fn(),
    getOneOffNotifications: jest.fn(),
    getAttachmentFile: jest.fn(),
    deleteAttachmentFile: jest.fn(),
    getOrphanedAttachmentFiles: jest.fn(),
    getAttachments: jest.fn(),
    deleteNotificationAttachment: jest.fn(),
    findAttachmentFileByChecksum: jest.fn(),
    filterNotifications: jest.fn(),
  };

  // biome-ignore lint/suspicious/noExplicitAny: any just for testing
  let mockNotification: DatabaseNotification<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);
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
      sendAfter: new Date(),
    };
  });

  it('should report that it supports attachments', () => {
    const adapter = new NodemailerNotificationAdapterFactory().create(mockTemplateRenderer, false, {
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: {
        user: 'username',
        pass: 'password',
      },
    } as SMTPTransport.Options);

    expect(adapter.supportsAttachments).toBe(true);
  });

  it('should send email with single attachment', async () => {
    const adapter = new NodemailerNotificationAdapterFactory().create(mockTemplateRenderer, false, {
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: {
        user: 'username',
        pass: 'password',
      },
    } as SMTPTransport.Options);
    adapter.injectBackend(mockBackend);

    const fileBuffer = Buffer.from('test file content');
    const mockFile: AttachmentFile = {
      read: jest.fn().mockResolvedValue(fileBuffer),
      stream: jest.fn(),
      url: jest.fn(),
      delete: jest.fn(),
    };

    const attachment: StoredAttachment = {
      id: 'att-1',
      fileId: 'file-1',
      filename: 'test.pdf',
      contentType: 'application/pdf',
      size: fileBuffer.length,
      checksum: 'abc123',
      description: 'Test file',
      file: mockFile,
      createdAt: new Date(),
      storageMetadata: { id: 'storage-1' },
    };

    mockNotification.attachments = [attachment];

    const context = { foo: 'bar' };
    const renderedTemplate = {
      subject: 'Test Subject',
      body: '<p>Test Body</p>',
    };
    const userEmail = 'user@example.com';

    mockTemplateRenderer.render.mockResolvedValue(renderedTemplate);
    mockBackend.getUserEmailFromNotification.mockResolvedValue(userEmail);

    await adapter.send(mockNotification, context);

    expect(mockFile.read).toHaveBeenCalled();
    expect(mockTransporter.sendMail).toHaveBeenCalledWith({
      to: userEmail,
      subject: renderedTemplate.subject,
      html: renderedTemplate.body,
      attachments: [
        {
          filename: 'test.pdf',
          content: fileBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  });

  it('should send email with multiple attachments', async () => {
    const adapter = new NodemailerNotificationAdapterFactory().create(mockTemplateRenderer, false, {
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: {
        user: 'username',
        pass: 'password',
      },
    } as SMTPTransport.Options);
    adapter.injectBackend(mockBackend);

    const fileBuffer1 = Buffer.from('file 1 content');
    const fileBuffer2 = Buffer.from('file 2 content');

    const mockFile1: AttachmentFile = {
      read: jest.fn().mockResolvedValue(fileBuffer1),
      stream: jest.fn(),
      url: jest.fn(),
      delete: jest.fn(),
    };

    const mockFile2: AttachmentFile = {
      read: jest.fn().mockResolvedValue(fileBuffer2),
      stream: jest.fn(),
      url: jest.fn(),
      delete: jest.fn(),
    };

    const attachment1: StoredAttachment = {
      id: 'att-1',
      fileId: 'file-1',
      filename: 'document.pdf',
      contentType: 'application/pdf',
      size: fileBuffer1.length,
      checksum: 'abc123',
      description: 'PDF document',
      file: mockFile1,
      createdAt: new Date(),
      storageMetadata: { id: 'storage-1' },
    };

    const attachment2: StoredAttachment = {
      id: 'att-2',
      fileId: 'file-2',
      filename: 'image.png',
      contentType: 'image/png',
      size: fileBuffer2.length,
      checksum: 'def456',
      description: 'Image file',
      file: mockFile2,
      createdAt: new Date(),
      storageMetadata: { id: 'storage-2' },
    };

    mockNotification.attachments = [attachment1, attachment2];

    const context = { foo: 'bar' };
    const renderedTemplate = {
      subject: 'Test Subject',
      body: '<p>Test Body</p>',
    };
    const userEmail = 'user@example.com';

    mockTemplateRenderer.render.mockResolvedValue(renderedTemplate);
    mockBackend.getUserEmailFromNotification.mockResolvedValue(userEmail);

    await adapter.send(mockNotification, context);

    expect(mockFile1.read).toHaveBeenCalled();
    expect(mockFile2.read).toHaveBeenCalled();
    expect(mockTransporter.sendMail).toHaveBeenCalledWith({
      to: userEmail,
      subject: renderedTemplate.subject,
      html: renderedTemplate.body,
      attachments: [
        {
          filename: 'document.pdf',
          content: fileBuffer1,
          contentType: 'application/pdf',
        },
        {
          filename: 'image.png',
          content: fileBuffer2,
          contentType: 'image/png',
        },
      ],
    });
  });

  it('should send email without attachments when attachments array is empty', async () => {
    const adapter = new NodemailerNotificationAdapterFactory().create(mockTemplateRenderer, false, {
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: {
        user: 'username',
        pass: 'password',
      },
    } as SMTPTransport.Options);
    adapter.injectBackend(mockBackend);

    mockNotification.attachments = [];

    const context = { foo: 'bar' };
    const renderedTemplate = {
      subject: 'Test Subject',
      body: '<p>Test Body</p>',
    };
    const userEmail = 'user@example.com';

    mockTemplateRenderer.render.mockResolvedValue(renderedTemplate);
    mockBackend.getUserEmailFromNotification.mockResolvedValue(userEmail);

    await adapter.send(mockNotification, context);

    expect(mockTransporter.sendMail).toHaveBeenCalledWith({
      to: userEmail,
      subject: renderedTemplate.subject,
      html: renderedTemplate.body,
    });
  });

  it('should send email without attachments when attachments is undefined', async () => {
    const adapter = new NodemailerNotificationAdapterFactory().create(mockTemplateRenderer, false, {
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: {
        user: 'username',
        pass: 'password',
      },
    } as SMTPTransport.Options);
    adapter.injectBackend(mockBackend);

    mockNotification.attachments = undefined;

    const context = { foo: 'bar' };
    const renderedTemplate = {
      subject: 'Test Subject',
      body: '<p>Test Body</p>',
    };
    const userEmail = 'user@example.com';

    mockTemplateRenderer.render.mockResolvedValue(renderedTemplate);
    mockBackend.getUserEmailFromNotification.mockResolvedValue(userEmail);

    await adapter.send(mockNotification, context);

    expect(mockTransporter.sendMail).toHaveBeenCalledWith({
      to: userEmail,
      subject: renderedTemplate.subject,
      html: renderedTemplate.body,
    });
  });
});
