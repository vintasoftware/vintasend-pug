import type { BaseLogger, ContextGenerator, DatabaseNotification } from 'vintasend';
import { logMessageMatching, renderLogMessage } from 'vintasend';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type PugInlineEmailTemplateRenderer,
  PugInlineEmailTemplateRendererFactory,
} from '../pug-inline-email-template-renderer';

type MockConfig = {
  ContextMap: { testContext: ContextGenerator };
  NotificationIdType: string;
  UserIdType: string;
};

describe('PugInlineEmailTemplateRenderer', () => {
  let renderer: PugInlineEmailTemplateRenderer<MockConfig>;
  let mockNotification: DatabaseNotification<MockConfig>;

  // Define template strings inline (plain text mode with interpolation)
  const templates = {
    'test-notification': `html
  head
    title Email
  body
    h1 Hello #{name}!
    p Your message: #{message}`,
    'test-subject': `| Welcome #{name}`,
    'invalid-template': `p= undefinedVariable.nonExistentProperty`,
    'invalid-subject': `| = undefinedVariable.nonExistentProperty`,
  };

  beforeEach(() => {
    renderer = new PugInlineEmailTemplateRendererFactory<MockConfig>().create(templates);
    mockNotification = {
      id: '123',
      notificationType: 'EMAIL' as const,
      contextName: 'testContext',
      contextParameters: {},
      userId: '456',
      title: 'Test Notification',
      bodyTemplate: 'test-notification',
      subjectTemplate: 'test-subject',
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
        subject: '| Welcome #{name}',
        body: 'p Hello #{name}!\np Message: #{message}',
      },
      {
        name: 'John',
        message: 'Hello World',
      },
    );

    expect(result.subject).toBe('Welcome John');
    expect(result.body).toContain('Hello John!');
    expect(result.body).toContain('Message: Hello World');
  });

  it('should throw when renderFromTemplateContent receives empty subject', async () => {
    await expect(
      renderer.renderFromTemplateContent(
        mockNotification,
        {
          subject: null,
          body: 'p Body',
        },
        {},
      ),
    ).rejects.toThrow('Subject template is required');
  });

  it('should throw error when subject template is missing', async () => {
    const notification = {
      ...mockNotification,
      id: 'test-notification',
      bodyTemplate: 'test-notification',
      subjectTemplate: null,
      userId: 'user123',
    };

    await expect(renderer.render(notification, {})).rejects.toThrow('Subject template is required');
  });

  it('should handle empty context', async () => {
    const notification = {
      ...mockNotification,
      id: 'test-notification',
      bodyTemplate: 'test-notification',
      subjectTemplate: 'test-subject',
      userId: 'user123',
    };

    const result = await renderer.render(notification, {});

    expect(result.subject).toBe('Welcome ');
    expect(result.body).toContain('Hello !');
    expect(result.body).toContain('Your message: ');
  });

  it('should throw error when template key not found', async () => {
    const notification = {
      ...mockNotification,
      subjectTemplate: 'non-existent-subject',
    };

    await expect(renderer.render(notification, {})).rejects.toThrow(
      'Subject template "non-existent-subject" not found in templates',
    );
  });

  it('should throw error when body template not found', async () => {
    const notification = {
      ...mockNotification,
      bodyTemplate: 'non-existent-body',
    };

    await expect(renderer.render(notification, {})).rejects.toThrow(
      'Body template "non-existent-body" not found in templates',
    );
  });

  it('should handle template runtime errors', async () => {
    const notification = {
      ...mockNotification,
      bodyTemplate: 'invalid-template',
      subjectTemplate: 'invalid-subject',
    };

    await expect(renderer.render(notification, { undefinedVariable: undefined })).rejects.toThrow();
  });

  it('should throw error when bodyTemplate is empty', async () => {
    const notification = {
      ...mockNotification,
      bodyTemplate: '',
    };

    await expect(renderer.render(notification, { name: 'Test' })).rejects.toThrow(
      'Body template is required',
    );
  });

  it('should throw error when subjectTemplate is empty', async () => {
    const notification = {
      ...mockNotification,
      subjectTemplate: '',
    };

    await expect(renderer.render(notification, { name: 'Test' })).rejects.toThrow(
      'Subject template is required',
    );
  });

  it('should create renderer with empty templates object', () => {
    const emptyRenderer = new PugInlineEmailTemplateRendererFactory<MockConfig>().create({});
    expect(emptyRenderer).toBeDefined();
  });

  it('should support logger injection', () => {
    const mockLogger: BaseLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    renderer.injectLogger(mockLogger);

    expect((renderer as any).logger).toBe(mockLogger);
  });

  it('should use logger when rendering fails', async () => {
    const mockLogger: BaseLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    renderer.injectLogger(mockLogger);

    const notification = {
      ...mockNotification,
      bodyTemplate: 'invalid-template',
      subjectTemplate: 'invalid-subject',
    };

    await expect(renderer.render(notification, { undefinedVariable: undefined })).rejects.toThrow();
    expect(mockLogger.error).toHaveBeenCalledWith(
      logMessageMatching(
        '[PugInlineEmailTemplateRenderer] Error rendering body template invalid-template for notification 123: TypeError',
      ),
    );
  });

  describe('log lines never carry template content, context or error messages', () => {
    // Synthetic data, not real PHI.
    const syntheticContext = {
      patientName: 'Jane Synthetic',
      patientEmail: 'jane.synthetic@example.com',
    };
    const forbidden = ['Jane Synthetic', 'jane.synthetic@example.com', 'patientName', 'throw new'];
    const throwingTemplate =
      "- throw new Error('Cannot render for ' + patientName + ' <' + patientEmail + '>')";

    function createLogger() {
      return { info: vi.fn(), warn: vi.fn(), error: vi.fn() } satisfies BaseLogger;
    }

    function renderedLines(logger: ReturnType<typeof createLogger>): string[] {
      return [logger.info, logger.warn, logger.error].flatMap((fn) =>
        fn.mock.calls.map((call) => renderLogMessage(call[0])),
      );
    }

    function expectNoSyntheticPhi(lines: string[]) {
      for (const line of lines) {
        for (const value of forbidden) {
          expect(line).not.toContain(value);
        }
      }
    }

    it('drops the error message when a stored body template throws', async () => {
      const phiRenderer = new PugInlineEmailTemplateRendererFactory<MockConfig>().create({
        'throwing-body': throwingTemplate,
        'test-subject': templates['test-subject'],
      });
      const logger = createLogger();
      phiRenderer.injectLogger(logger);

      const error = await phiRenderer
        .render({ ...mockNotification, bodyTemplate: 'throwing-body' }, syntheticContext)
        .catch((e: unknown) => e);

      // The thrown error does quote the context, which is why it must not be logged.
      expect((error as Error).message).toContain('Jane Synthetic');
      expect(logger.error).toHaveBeenCalledWith(
        logMessageMatching(
          '[PugInlineEmailTemplateRenderer] Error rendering body template throwing-body for notification 123: Error',
        ),
      );
      expectNoSyntheticPhi(renderedLines(logger));
    });

    it('drops the error message when a stored subject template throws', async () => {
      const phiRenderer = new PugInlineEmailTemplateRendererFactory<MockConfig>().create({
        'test-notification': templates['test-notification'],
        'throwing-subject': throwingTemplate,
      });
      const logger = createLogger();
      phiRenderer.injectLogger(logger);

      await expect(
        phiRenderer.render(
          { ...mockNotification, subjectTemplate: 'throwing-subject' },
          { ...syntheticContext, name: 'Jane Synthetic', message: 'jane.synthetic@example.com' },
        ),
      ).rejects.toThrow('Jane Synthetic');
      expect(logger.error).toHaveBeenCalledTimes(1);
      expectNoSyntheticPhi(renderedLines(logger));
    });

    it('drops the error message when template content fails to render', async () => {
      const logger = createLogger();
      renderer.injectLogger(logger);

      await expect(
        renderer.renderFromTemplateContent(
          mockNotification,
          { body: throwingTemplate, subject: '| Hi #{patientName}' },
          syntheticContext,
        ),
      ).rejects.toThrow('jane.synthetic@example.com');
      await expect(
        renderer.renderFromTemplateContent(
          mockNotification,
          { body: 'p Hello #{patientName}', subject: throwingTemplate },
          syntheticContext,
        ),
      ).rejects.toThrow('jane.synthetic@example.com');

      expect(logger.error).toHaveBeenCalledWith(
        logMessageMatching(
          '[PugInlineEmailTemplateRenderer] Error rendering body template content for notification 123: Error',
        ),
      );
      expect(logger.error).toHaveBeenCalledWith(
        logMessageMatching(
          '[PugInlineEmailTemplateRenderer] Error rendering subject template content for notification 123: Error',
        ),
      );
      expectNoSyntheticPhi(renderedLines(logger));
    });

    it('does not log the rendered output on success', async () => {
      const logger = createLogger();
      renderer.injectLogger(logger);

      const result = await renderer.renderFromTemplateContent(
        mockNotification,
        { body: 'p Hello #{patientName} <#{patientEmail}>', subject: '| Hi #{patientName}' },
        syntheticContext,
      );

      expect(result.subject).toBe('Hi Jane Synthetic');
      expect(renderedLines(logger)).toEqual([
        '[PugInlineEmailTemplateRenderer] Rendering template from content for notification 123',
      ]);
    });
  });
});
