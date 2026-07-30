import cheerio from 'cheerio';
import { AxiosResponse } from 'axios';
import { Request } from 'express';
import { ISeasonsList, ISeries, ISeriesDetails } from '@/types';

/**
 * Scrape series asynchronously
 * @param {Request} ExpressRequest
 * @param {AxiosResponse} AxiosResponse
 * @returns {Promise.<ISeries>} array of series objects
 */
export const scrapeSeries = async (
    req: Request,
    res: AxiosResponse
): Promise<ISeries[]> => {
    const $: cheerio.Root = cheerio.load(res.data);
    const payload: ISeries[] = [];
    const {
        headers: { host },
        protocol,
    } = req;

    $('main article').each((i, el) => {
        const link = $(el).find('figure > a[href]').first();

        if (!link.length) return;

        const href = link.attr('href') ?? '';
        const seriesId = href.split('/').filter(Boolean).pop() ?? '';

        if (!seriesId) return;

        const genres = Array.from(
            new Set(
                [
                    $(el).find('meta[itemprop="genre"]').attr('content') ?? '',
                    $(el).find('figcaption .genre').text(),
                    $(el)
                        .find('footer div.grid-categories > a')
                        .map((_, el2) => $(el2).text())
                        .get()
                        .join(', '),
                ]
                    .join(',')
                    .split(',')
                    .map((genre) => genre.trim())
                    .filter(Boolean)
            )
        );

        const obj = {} as ISeries;

        obj['_id'] = seriesId;
        obj['title'] =
            $(el).find('h3.poster-title').text().trim() ||
            link.find('img').attr('alt')?.replace(/\s*\(\d{4}\)$/, '').trim() ||
            '';
        obj['type'] = 'series';
        obj['posterImg'] =
            link.find('img').attr('src') ??
            link.find('img').attr('data-src') ??
            link.find('img').attr('data-lazy-src') ??
            link
                .find('source[type="image/webp"]')
                .attr('srcset')
                ?.split(',')
                .shift()
                ?.trim()
                .split(' ')
                .shift() ??
            '';
        const episodeText =
            $(el).find('.last-episode span').text().trim() ||
            $(el).find('.episode').text().trim() ||
            '0';

        obj['episode'] = Number(episodeText) || 0;
        obj['rating'] =
            $(el).find('[itemprop="ratingValue"]').text().trim() ||
            $(el).find('div.rating').text().trim();
        obj['url'] = `${protocol}://${host}/series/${seriesId}`;
        obj['genres'] = genres;

        payload.push(obj);
    });

    return payload;
};

/**
 * Scrape series details asynchronously
 * @param {Request} ExpressRequest
 * @param {AxiosResponse} AxiosResponse
 * @returns {Promise.<ISeriesDetails>} series details object
 */
export const scrapeSeriesDetails = async (
    req: Request,
    res: AxiosResponse
): Promise<ISeriesDetails> => {
    const $: cheerio.Root = cheerio.load(res.data);
    const obj = {} as ISeriesDetails;

    const originalUrl = req.originalUrl;
    const structuredData: Array<Record<string, unknown>> = [];

    $('script[type="application/ld+json"]').each((_, el) => {
        const raw = $(el).text().trim();

        if (!raw) return;

        try {
            const parsed = JSON.parse(raw) as
                | Record<string, unknown>
                | Array<Record<string, unknown>>;

            if (Array.isArray(parsed)) {
                structuredData.push(...parsed);
                return;
            }

            if (Array.isArray(parsed['@graph'])) {
                structuredData.push(...(parsed['@graph'] as Array<Record<string, unknown>>));
                return;
            }

            structuredData.push(parsed);
        } catch {
            return;
        }
    });

    const seriesSchema = structuredData.find((entry) => {
        const type = entry['@type'];

        return (
            type === 'TVSeries' ||
            type === 'Series' ||
            (Array.isArray(type) &&
                (type.includes('TVSeries') || type.includes('Series')))
        );
    });

    const toTextArray = (value: unknown): string[] => {
        if (!value) return [];

        const values = Array.isArray(value) ? value : [value];

        return values
            .map((item) => {
                if (typeof item === 'string') return item.trim();

                if (item && typeof item === 'object' && 'name' in item) {
                    return String((item as Record<string, unknown>).name ?? '').trim();
                }

                return '';
            })
            .filter(Boolean);
    };

    obj['_id'] = originalUrl.split('/').reverse()[0];
    obj['title'] = $('h1').first().text().trim() || String(seriesSchema?.name ?? '');
    obj['type'] = 'series';
    obj['posterImg'] =
        String(seriesSchema?.image ?? '') || $('meta[property="og:image"]').attr('content') || '';
    obj['duration'] = String(seriesSchema?.duration ?? '').trim();
    obj['rating'] = String(
        seriesSchema?.aggregateRating &&
            typeof seriesSchema.aggregateRating === 'object' &&
            'ratingValue' in seriesSchema.aggregateRating
            ? (seriesSchema.aggregateRating as Record<string, unknown>).ratingValue ?? ''
            : ''
    ).trim();
    obj['releaseDate'] = String(seriesSchema?.datePublished ?? '').trim();
    obj['status'] =
        $('meta[property="og:video:status"]').attr('content') ??
        $('span.status').text().trim().toLowerCase() ??
        '';
    obj['synopsis'] =
        String(seriesSchema?.description ?? '') ||
        $('meta[name="description"]').attr('content') ||
        '';
    obj['trailerUrl'] =
        $('a[href*="youtube.com/watch"]').first().attr('href') ??
        $('iframe[src*="youtube.com"]').first().attr('src') ??
        '';
    obj['genres'] = toTextArray(seriesSchema?.genre);
    obj['directors'] = toTextArray(seriesSchema?.director);
    obj['countries'] = toTextArray(seriesSchema?.country);
    obj['casts'] = toTextArray(seriesSchema?.actor);
    obj['seasons'] = [];

    return obj;
};
