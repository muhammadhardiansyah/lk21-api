import cheerio from 'cheerio';
import { AxiosResponse } from 'axios';
import { Request } from 'express';
import { ISearchedMoviesOrSeries } from '@/types';

/**
 * Scrape searched movies or series
 * @param {Request} req
 * @param {AxiosResponse} res
 * @returns {Promise.<ISearchedMoviesOrSeries[]>} array of movies or series
 */
export const scrapeSearchedMoviesOrSeries = async (
    req: Request,
    res: AxiosResponse
): Promise<ISearchedMoviesOrSeries[]> => {
    const $: cheerio.Root = cheerio.load(res.data);
    const payload: ISearchedMoviesOrSeries[] = [];
    const {
        headers: { host },
        protocol,
    } = req;

    $('main article').each((i, el) => {
        const link = $(el).find('figure > a[href]').first();

        if (!link.length) return;

        const href = link.attr('href') ?? '';
        const movieId = href.split('/').filter(Boolean).pop() ?? '';

        if (!movieId) return;

        const type: 'movie' | 'series' = href.includes('/series/') ? 'series' : 'movie';
        const genres = Array.from(
            new Set(
                [
                    $(el).find('meta[itemprop="genre"]').attr('content') ?? '',
                    $(el).find('figcaption .genre').text(),
                ]
                    .join(',')
                    .split(',')
                    .map((genre) => genre.trim())
                    .filter(Boolean)
            )
        );

        const obj = {} as ISearchedMoviesOrSeries;

        obj['_id'] = movieId;
        obj['title'] =
            $(el).find('h3.poster-title').text().trim() ||
            link.find('img').attr('alt')?.replace(/\s*\(\d{4}\)$/, '').trim() ||
            '';
        obj['type'] = type;
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
        obj['url'] = `${protocol}://${host}/${type === 'movie' ? 'movies' : 'series'}/${movieId}`;
        obj['genres'] = genres;
        obj['directors'] = [];
        obj['casts'] = [];

        payload.push(obj);
    });

    return payload;
};
