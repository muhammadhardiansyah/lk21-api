import { Request } from 'express';
import cheerio from 'cheerio';
import { AxiosResponse } from 'axios';
import { IMovies, IMovieDetails } from '@/types';

/**
 * Scrape movies asynchronously
 * @param {Request} ExpressRequest
 * @param {AxiosResponse} AxiosResponse
 * @returns {Promise.<IMovies[]>} array of movies objects
 */
export const scrapeMovies = async (
    req: Request,
    res: AxiosResponse
): Promise<IMovies[]> => {
    const $: cheerio.Root = cheerio.load(res.data);
    const payload: IMovies[] = [];
    const {
        protocol,
        headers: { host },
    } = req;

    $('main article').each((i, el) => {
        const link = $(el).find('figure > a[href]').first();

        if (!link.length) return;

        const href = link.attr('href') ?? '';
        const movieId = href.split('/').filter(Boolean).pop() ?? '';

        if (!movieId) return;

        const title =
            $(el).find('h3.poster-title').text().trim() ||
            link.find('img').attr('alt')?.replace(/\s*\(\d{4}\)$/, '').trim() ||
            '';

        const posterSrc =
            link.find('img').attr('src') ??
            link
                .find('source[type="image/webp"]')
                .attr('srcset')
                ?.split(',')
                .shift()
                ?.trim()
                .split(' ')
                .shift() ??
            '';

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

        const obj = {} as IMovies;

        obj['_id'] = movieId;
        obj['title'] = title;
        obj['type'] = 'movie';
        obj['posterImg'] = posterSrc.startsWith('http')
            ? posterSrc
            : `https:${posterSrc}`;
        obj['rating'] =
            $(el).find('[itemprop="ratingValue"]').text().trim() ||
            $(el).find('div.rating').text().trim();
        obj['url'] = `${protocol}://${host}/movies/${movieId}`;
        obj['qualityResolution'] =
            $(el).find('.label').first().text().trim() ||
            $(el).find('div.quality').text().trim();
        obj['genres'] = genres;

        payload.push(obj);
    });

    return payload;
};

/**
 * Scrape movie details asynchronously
 * @param {Request} ExpressRequest
 * @param {AxiosResponse} AxiosResponse
 * @returns {Promise.<IMovieDetails>} movie details object
 */
export const scrapeMovieDetails = async (
    req: Request,
    res: AxiosResponse
): Promise<IMovieDetails> => {
    const $: cheerio.Root = cheerio.load(res.data);
    const obj = {} as IMovieDetails;

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

    const movieSchema = structuredData.find((entry) => {
        const type = entry['@type'];

        return type === 'Movie' || (Array.isArray(type) && type.includes('Movie'));
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

    const title = $('h1').first().text().trim() || String(movieSchema?.name ?? '');
    const image =
        String(movieSchema?.image ?? '') || $('meta[property="og:image"]').attr('content') || '';
    const description =
        String(movieSchema?.description ?? '') || $('meta[name="description"]').attr('content') || '';

    obj['_id'] = originalUrl.split('/').reverse()[0];
    obj['title'] = title;
    obj['type'] = 'movie';
    obj['posterImg'] = image;
    obj['duration'] = String(movieSchema?.duration ?? '').trim();
    obj['rating'] = String(movieSchema?.aggregateRating && typeof movieSchema.aggregateRating === 'object' && 'ratingValue' in movieSchema.aggregateRating ? (movieSchema.aggregateRating as Record<string, unknown>).ratingValue ?? '' : '').trim();
    obj['releaseDate'] = String(movieSchema?.datePublished ?? '').trim();
    obj['quality'] = $('meta[property="og:video:tag"]').attr('content') ?? '';
    obj['synopsis'] = description;
    obj['trailerUrl'] =
        $('a[href*="youtube.com/watch"]').first().attr('href') ??
        $('a.fancybox').first().attr('href') ??
        '';
    obj['genres'] = toTextArray(movieSchema?.genre);
    obj['directors'] = toTextArray(movieSchema?.director);
    obj['countries'] = toTextArray(movieSchema?.country);
    obj['casts'] = toTextArray(movieSchema?.actor);

    return obj;
};
