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
    const bodyTemplate = pug.compileFile(notification.bodyTemplate, this.options);

    if (!notification.subjectTemplate) {
      throw new Error('Subject template is required');
    }

    const subjectTemplate = pug.compileFile(notification.subjectTemplate, this.options);
    return new Promise((resolve) => {
      resolve({
        subject: subjectTemplate(context),
        body: bodyTemplate(context),
      });
    });
  }
}

export class PugEmailTemplateRendererFactory<Config extends BaseNotificationTypeConfig> {
  create(options: pug.Options = {}) {
    return new PugEmailTemplateRenderer<Config>(options);
  }
}
