import { isValidElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import ChatPage from '@/app/chat/page';

function findChatIntakeProps(node: ReactNode): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findChatIntakeProps(child);
      if (found) {
        return found;
      }
    }
    return null;
  }

  if (!isValidElement(node)) {
    return null;
  }

  const props = node.props as Record<string, unknown>;
  if ('initialQuery' in props && 'initialProcedure' in props && 'embed' in props) {
    return props;
  }

  return findChatIntakeProps(props.children as ReactNode);
}

describe('Next.js page contracts', () => {
  it('awaits asynchronous chat search params before initializing the client flow', async () => {
    const page = await ChatPage({
      searchParams: Promise.resolve({
        q: 'Tôi muốn đăng ký kết hôn',
        procedure: 'MARRIAGE_REGISTRATION',
        embed: '1',
      }),
    });

    expect(findChatIntakeProps(page)).toMatchObject({
      initialQuery: 'Tôi muốn đăng ký kết hôn',
      initialProcedure: 'MARRIAGE_REGISTRATION',
      embed: true,
    });
  });
});
