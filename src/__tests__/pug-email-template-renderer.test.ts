import { join } from 'node:path';
import type { BaseLogger, ContextGenerator, DatabaseNotification } from 'vintasend';
import { renderLogMessage } from 'vintasend';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PugEmailTemplateRenderer } from '../index';
import { PugEmailTemplateRendererFactory } from '../index';

type MockConfig = {
  ContextMap: { testContext: ContextGenerator };
  NotificationIdType: string;
  UserIdType: string;
};

describe('PugEmailTemplateRenderer', () => {
  const fixturesPath = join(__dirname, 'fixtures');
  let renderer: PugEmailTemplateRenderer<MockConfig>;
  let mockNotification: DatabaseNotification<MockConfig> = {
    id: '123',
    notificationType: 'EMAIL' as const,
    contextName: 'testContext',
    contextParameters: {},
    userId: '456',
    title: 'Test Notification',
    bodyTemplate: join(fixturesPath, 'test-notification.pug'),
    subjectTemplate: join(fixturesPath, 'test-subject.pug'),
    extraParams: {},
    contextUsed: null,
    adapterUsed: null,
    status: 'PENDING_SEND' as const,
    sentAt: null,
    readAt: null,
    sendAfter: new Date(),
    gitCommitSha: null,
  };

  beforeEach(() => {
    renderer = new PugEmailTemplateRendererFactory<MockConfig>().create({});
    mockNotification = {
      id: '123',
      notificationType: 'EMAIL' as const,
      contextName: 'testContext',
      contextParameters: {},
      userId: '456',
      title: 'Test Notification',
      bodyTemplate: join(fixturesPath, 'test-notification.pug'),
      subjectTemplate: join(fixturesPath, 'test-subject.pug'),
      extraParams: {},
      contextUsed: null,
      adapterUsed: null,
      status: 'PENDING_SEND' as const,
      sentAt: null,
      readAt: null,
      sendAfter: new Date(),
      gitCommitSha: null,
    };
  });

  it('should default to empty object if no options passed', async () => {
    renderer = new PugEmailTemplateRendererFactory<MockConfig>().create();
    // biome-ignore lint/complexity/useLiteralKeys: accessing private attribute
    expect(renderer['options']).toStrictEqual({});
  });

  it('should render email template with context', async () => {
    const context = {
      name: 'John',
      message: 'Hello World',
    };

    const result = await renderer.render(mockNotification, context);

    expect(result.subject).toBe('Welcome John');
    expect(result.body).toContain('Hello John!');
    expect(result.body).toContain('Your message: Hello World');
  });

  it('should render email template from template content', async () => {
    const result = await renderer.renderFromTemplateContent(
      mockNotification,
      {
        subject: 'span Welcome #{name}',
        body: 'p Hello #{name}!\np Message: #{message}',
      },
      {
        name: 'John',
        message: 'Hello World',
      },
    );

    expect(result.subject).toBe('<span>Welcome John</span>');
    expect(result.body).toContain('<p>Hello John!</p>');
    expect(result.body).toContain('<p>Message: Hello World</p>');
  });

  it('should throw when subject template content is missing', async () => {
    await expect(
      renderer.renderFromTemplateContent(
        mockNotification,
        {
          subject: null,
          body: 'p body',
        },
        {},
      ),
    ).rejects.toThrow('Subject template is required');
  });

  it('should throw error when subject template is missing', async () => {
    const notification = {
      ...mockNotification,
      id: 'test-notification',
      bodyTemplate: join(fixturesPath, 'test-notification.pug'),
      subjectTemplate: null,
      userId: 'user123',
    };

    await expect(renderer.render(notification, {})).rejects.toThrow('Subject template is required');
  });

  it('should handle empty context', async () => {
    const notification = {
      ...mockNotification,
      id: 'test-notification',
      bodyTemplate: join(fixturesPath, 'test-notification.pug'),
      subjectTemplate: join(fixturesPath, 'test-subject.pug'),
      userId: 'user123',
    };

    const result = await renderer.render(notification, {});

    expect(result.subject).toBe('Welcome ');
    expect(result.body).toContain('Hello !');
    expect(result.body).toContain('Your message: ');
  });

  it('should handle template compilation errors in subject template', async () => {
    const notification = {
      ...mockNotification,
      subjectTemplate: join(fixturesPath, 'non-existent-subject.pug'),
    };

    await expect(renderer.render(notification, {})).rejects.toThrow();
  });

  it('should handle template compilation errors in body template', async () => {
    const notification = {
      ...mockNotification,
      bodyTemplate: join(fixturesPath, 'non-existent-body.pug'),
    };

    await expect(renderer.render(notification, {})).rejects.toThrow();
  });

  it('should handle template runtime errors', async () => {
    const notification = {
      ...mockNotification,
      bodyTemplate: join(fixturesPath, 'invalid-template.pug'),
      subjectTemplate: join(fixturesPath, 'invalid-subject.pug'),
    };

    // Create invalid template files with syntax that will cause runtime errors
    await expect(renderer.render(notification, { undefinedVariable: undefined })).rejects.toThrow();
  });

  it('should support logger injection', () => {
    const mockLogger: BaseLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    renderer.injectLogger(mockLogger);

    // biome-ignore lint/complexity/useLiteralKeys: accessing private attribute
    expect(renderer['logger']).toBe(mockLogger);
  });

  describe('log lines never carry template content, context or error messages', () => {
    // Synthetic data, not real PHI.
    const syntheticContext = {
      name: 'Jane Synthetic',
      message: 'jane.synthetic@example.com',
      patientName: 'Jane Synthetic',
      patientEmail: 'jane.synthetic@example.com',
    };
    const forbidden = ['Jane Synthetic', 'jane.synthetic@example.com', 'patientName', 'throw new'];

    function createLogger() {
      return { info: vi.fn(), warn: vi.fn(), error: vi.fn() } satisfies BaseLogger;
    }

    function renderedLines(logger: ReturnType<typeof createLogger>): string[] {
      return [logger.info, logger.warn, logger.error].flatMap((fn) =>
        fn.mock.calls.map((call) => renderLogMessage(call[0])),
      );
    }

    it('logs only ids and template paths when rendering template files', async () => {
      const logger = createLogger();
      renderer.injectLogger(logger);

      const result = await renderer.render(mockNotification, syntheticContext);

      expect(result.body).toContain('Jane Synthetic');
      expect(renderedLines(logger)).toEqual([
        'Rendering email template for notification 123',
        `Compiling body template: ${mockNotification.bodyTemplate}`,
        `Compiling subject template: ${mockNotification.subjectTemplate}`,
        'Email template rendered successfully for notification 123',
      ]);
    });

    it('does not log the error message when template content throws', async () => {
      const logger = createLogger();
      renderer.injectLogger(logger);

      await expect(
        renderer.renderFromTemplateContent(
          mockNotification,
          {
            body: "- throw new Error('Cannot render for ' + patientName + ' <' + patientEmail + '>')",
            subject: '| Hi #{patientName}',
          },
          syntheticContext,
        ),
      ).rejects.toThrow('Jane Synthetic');

      const lines = renderedLines(logger);
      expect(lines).toEqual(['Rendering email template from content for notification 123']);
      for (const line of lines) {
        for (const value of forbidden) {
          expect(line).not.toContain(value);
        }
      }
    });
  });
});
