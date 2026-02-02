import type {
  BaseEmailTemplateRenderer,
  EmailTemplate,
} from 'vintasend/dist/services/notification-template-renderers/base-email-template-renderer';
import type { JsonObject } from 'vintasend/dist/types/json-values';
import type { DatabaseNotification } from 'vintasend/dist/types/notification';
import type { BaseNotificationTypeConfig } from 'vintasend/dist/types/notification-type-config';
import type { BaseLogger } from 'vintasend/dist/services/loggers/base-logger';

import pug from 'pug';

export class PugEmailTemplateRenderer<Config extends BaseNotificationTypeConfig>
  implements BaseEmailTemplateRenderer<Config>
{
  private logger: BaseLogger | null = null;

  constructor(private options: pug.Options) {}

  /**
   * Inject logger (called by VintaSend when logger exists)
   */
  injectLogger(logger: BaseLogger): void {
    this.logger = logger;
  }

  async render(
    notification: DatabaseNotification<Config>,
    context: JsonObject,
  ): Promise<EmailTemplate> {
    this.logger?.info(`Rendering email template for notification ${notification.id}`);
    this.logger?.info(`Compiling body template: ${notification.bodyTemplate}`);
    const bodyTemplate = pug.compileFile(notification.bodyTemplate, this.options);

    if (!notification.subjectTemplate) {
      this.logger?.info('Subject template missing');
      throw new Error('Subject template is required');
    }

    this.logger?.info(`Compiling subject template: ${notification.subjectTemplate}`);
    const subjectTemplate = pug.compileFile(notification.subjectTemplate, this.options);
    return new Promise((resolve) => {
      const rendered = {
        subject: subjectTemplate(context),
        body: bodyTemplate(context),
      };
      this.logger?.info(`Email template rendered successfully for notification ${notification.id}`);
      resolve(rendered);
    });
  }
}

export class PugEmailTemplateRendererFactory<Config extends BaseNotificationTypeConfig> {
  create(options: pug.Options = {}) {
    return new PugEmailTemplateRenderer<Config>(options);
  }
}
