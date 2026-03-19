import type { DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import { parseDate } from '@/utils/parse-date';
import { config } from '@/config';

interface SlackAttachment {
    text?: string;
    title?: string;
    image_url?: string;
}

interface SlackFile {
    url_private?: string;
    name?: string;
    mimetype?: string;
}

interface SlackMessage {
    type: string;
    text?: string;
    user?: string;
    ts: string;
    attachments?: SlackAttachment[];
    files?: SlackFile[];
    bot_id?: string;
    subtype?: string;
}

interface SlackChannel {
    id: string;
    name: string;
    is_channel: boolean;
    is_group: boolean;
    is_im: boolean;
    is_archived: boolean;
}

export const route: Route = {
    path: '/workspace/:workspace',
    categories: ['social-media'],
    example: '/slack/workspace/test',
    parameters: {
        workspace: '工作区标识符',
    },
    features: {
        requireConfig: [
            {
                name: 'SLACK_TOKEN_workspace',
                description: 'Slack Token（以 xoxc- 开头）',
            },
        ],
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: 'Slack 工作区聚合消息',
    maintainers: [],
    handler,
    description: `
:::tip
此路由聚合工作区所有频道的消息。

**配置方法：**

SLACK_TOKEN_company="xoxc-xxx"
SLACK_COOKIE_company="可选，需要时添加"

**URL 格式：**
/slack/workspace/{workspace}?limit=100
:::
    `,
};

async function handler(ctx) {
    const { workspace } = ctx.req.param();
    const limit = ctx.req.query('limit') ? Number.parseInt(ctx.req.query('limit')) : 50;
    
    // 检查 access key（如果配置了）
    const configAccessKey = process.env.SLACK_ACCESS_KEY;
    const requestAccessKey = ctx.req.query('key');
    
    if (configAccessKey && configAccessKey !== requestAccessKey) {
        throw new Error('Invalid or missing access key. Please provide the correct key via ?key= parameter.');
    }
    
    const token = process.env[`SLACK_TOKEN_${workspace}`];
    const cookie = process.env[`SLACK_COOKIE_${workspace}`];

    if (!token) {
        throw new Error(`SLACK_TOKEN_${workspace} is required.`);
    }

    const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    };
    
    if (cookie) {
        headers.Cookie = cookie;
    }

    // 获取频道列表
    const channels = await cache.tryGet(
        `slack:channels:${workspace}`,
        async () => {
            const formData = new FormData();
            formData.append('token', token);
            formData.append('exclude_archived', 'true');
            formData.append('types', 'public_channel,private_channel');

            const response = await fetch('https://llm-d.slack.com/api/conversations.list', {
                method: 'POST',
                headers,
                body: formData,
            });

            const data = await response.json();

            if (!data.ok) {
                throw new Error(`Slack API error: ${data.error || 'Unknown error'}`);
            }

            return data.channels?.filter((ch: SlackChannel) => !ch.is_archived) || [];
        },
        config.cache.routeExpire,
        false
    );

    // 获取每个频道的消息
    const allMessages: Array<SlackMessage & { channelName: string; channelId: string }> = [];
    
    for (const channel of channels) {
        try {
            const messages = await cache.tryGet(
                `slack:channel:${workspace}:${channel.id}:messages`,
                async () => {
                    const formData = new FormData();
                    formData.append('token', token);
                    formData.append('channel', channel.id);
                    formData.append('limit', '20');

                    const response = await fetch('https://llm-d.slack.com/api/conversations.history', {
                        method: 'POST',
                        headers,
                        body: formData,
                    });

                    const data = await response.json();

                    if (!data.ok) {
                        return [];
                    }

                    return data.messages?.filter((msg: SlackMessage) => msg.type === 'message' && msg.text) || [];
                },
                config.cache.routeExpire,
                false
            );

            for (const msg of messages) {
                allMessages.push({
                    ...msg,
                    channelName: channel.name,
                    channelId: channel.id,
                });
            }
        } catch {
            // 跳过无法访问的频道
        }
    }

    // 按时间排序
    allMessages.sort((a, b) => Number.parseFloat(b.ts) - Number.parseFloat(a.ts));

    // 限制数量
    const limitedMessages = allMessages.slice(0, limit);

    const items: DataItem[] = limitedMessages.map((msg) => {
        let description = msg.text || '';

        if (msg.attachments && msg.attachments.length > 0) {
            for (const attachment of msg.attachments) {
                if (attachment.title) {
                    description += `<h3>${attachment.title}</h3>`;
                }
                if (attachment.text) {
                    description += `<p>${attachment.text}</p>`;
                }
                if (attachment.image_url) {
                    description += `<img src="${attachment.image_url}" />`;
                }
            }
        }

        if (msg.files && msg.files.length > 0) {
            description += '<p>附件：</p><ul>';
            for (const file of msg.files) {
                description += `<li><a href="${file.url_private}">${file.name}</a></li>`;
            }
            description += '</ul>';
        }

        const author = msg.user || msg.bot_id || 'Unknown';

        return {
            title: `[${msg.channelName}] ${msg.text?.slice(0, 80) || '(无标题)'}`,
            description,
            link: `https://app.slack.com/client/T${msg.channelId}/${msg.channelId}`,
            author,
            pubDate: parseDate(Number.parseFloat(msg.ts) * 1000),
            guid: `slack:${workspace}:${msg.channelId}:${msg.ts}`,
            category: [msg.channelName],
        };
    });

    return {
        title: `Slack Workspace - ${workspace}`,
        link: `https://app.slack.com`,
        description: `Slack 工作区 ${workspace} 的所有频道消息聚合`,
        item: items,
    };
}
