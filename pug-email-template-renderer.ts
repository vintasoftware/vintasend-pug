import type { ContextGenerator } from 'vintasend/src/services/notification-context-registry';
import type {
  BaseEmailTemplateRenderer,
  EmailTemplate,
} from 'vintasend/src/services/notification-template-renderers/base-email-template-renderer';
import type { JsonObject } from 'vintasend/src/types/json-values';
import type { Notification } from 'vintasend/src/types/notification';

import pug from 'pug';

export class PugEmailTemplateRenderer<AvailableContexts extends Record<string, ContextGenerator>>
  implements BaseEmailTemplateRenderer<AvailableContexts>
{
  constructor(private options: pug.Options = {}) {}

  render(
    notification: Notification<AvailableContexts>,
    context: JsonObject,
  ): Promise<EmailTemplate> {
    const bodyTemplate = pug.compileFile(notification.bodyTemplate, this.options);

    if (!notification.subjectTemplate) {
      throw new Error('Subject template is required');
    }

    const subjectTemplate = pug.compileFile(notification.subjectTemplate, this.options);
    return new Promise((resolve) => {
      resolve({
        subject: subjectTemplate(context || {}),
        body: bodyTemplate(context || {}),
      });
    });
  }
}
