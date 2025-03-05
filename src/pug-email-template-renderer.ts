import type { ContextGenerator } from 'vintasend/dist/services/notification-context-registry';
import type {
  BaseEmailTemplateRenderer,
  EmailTemplate,
} from 'vintasend/dist/services/notification-template-renderers/base-email-template-renderer';
import type { JsonObject } from 'vintasend/dist/types/json-values';
import type { Notification } from 'vintasend/dist/types/notification';
import type { Identifier } from 'vintasend/dist/types/identifier';

import pug from 'pug';

export class PugEmailTemplateRenderer<
  AvailableContexts extends Record<string, ContextGenerator>,
  NotificationIdType extends Identifier = Identifier,
  UserIdType extends Identifier = Identifier,
> implements BaseEmailTemplateRenderer<AvailableContexts, NotificationIdType, UserIdType>
{
  constructor(private options: pug.Options = {}) {}

  render(
    notification: Notification<AvailableContexts, NotificationIdType, UserIdType>,
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
