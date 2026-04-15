-- Backfill structured Google Maps place fields from existing map_link values.
-- Safe strategy:
-- 1. Prefer existing values if the row already has place_id / formatted_address / lat / lng / map_source.
-- 2. Only parse from map_link when a value can be recognized reliably.
-- 3. Do not guess from free-text location alone.

with club_source as (
  select
    id,
    trim(coalesce(map_link, '')) as map_link,
    nullif(substring(trim(coalesce(map_link, '')) from '(?:[?&]query_place_id=)([^&#]+)'), '') as place_id_raw,
    nullif(substring(trim(coalesce(map_link, '')) from '(?:[?&](?:q|query|destination|daddr)=)([^&#]+)'), '') as query_raw,
    nullif(substring(trim(coalesce(map_link, '')) from '(?:[?&](?:center|ll)=)([^&#]+)'), '') as center_raw,
    nullif(substring(trim(coalesce(map_link, '')) from '@(-?\d+(?:\.\d+)?)'), '') as at_lat_raw,
    nullif(substring(trim(coalesce(map_link, '')) from '@-?\d+(?:\.\d+)?,(-?\d+(?:\.\d+)?)'), '') as at_lng_raw,
    nullif(substring(trim(coalesce(map_link, '')) from '/place/([^/?#]+)'), '') as place_path_raw
  from public.clubs
),
club_parsed as (
  select
    id,
    map_link,
    place_id_raw,
    nullif(
      trim(both ' ' from
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(
                        replace(
                          case
                            when replace(replace(coalesce(query_raw, ''), '%2C', ','), '%2c', ',') ~ '^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$' then coalesce(place_path_raw, '')
                            else coalesce(query_raw, place_path_raw, '')
                          end,
                          '+', ' '
                        ),
                        '%20', ' '
                      ),
                      '%2C', ','
                    ),
                    '%2c', ','
                  ),
                  '%2F', '/'
                ),
                '%2f', '/'
              ),
              '%26', '&'
            ),
            '%28', '('
          ),
          '%29', ')'
        )
      ),
      ''
    ) as formatted_address_raw,
    case
      when replace(replace(coalesce(center_raw, ''), '%2C', ','), '%2c', ',') ~ '^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$'
        then split_part(replace(replace(center_raw, '%2C', ','), '%2c', ','), ',', 1)::double precision
      when replace(replace(coalesce(query_raw, ''), '%2C', ','), '%2c', ',') ~ '^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$'
        then split_part(replace(replace(query_raw, '%2C', ','), '%2c', ','), ',', 1)::double precision
      when at_lat_raw is not null
        then at_lat_raw::double precision
      else null
    end as lat_raw,
    case
      when replace(replace(coalesce(center_raw, ''), '%2C', ','), '%2c', ',') ~ '^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$'
        then split_part(replace(replace(center_raw, '%2C', ','), '%2c', ','), ',', 2)::double precision
      when replace(replace(coalesce(query_raw, ''), '%2C', ','), '%2c', ',') ~ '^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$'
        then split_part(replace(replace(query_raw, '%2C', ','), '%2c', ','), ',', 2)::double precision
      when at_lng_raw is not null
        then at_lng_raw::double precision
      else null
    end as lng_raw
  from club_source
),
updated_clubs as (
  update public.clubs as clubs
  set
    place_id = coalesce(nullif(clubs.place_id, ''), club_parsed.place_id_raw),
    formatted_address = coalesce(nullif(clubs.formatted_address, ''), club_parsed.formatted_address_raw),
    lat = coalesce(clubs.lat, club_parsed.lat_raw),
    lng = coalesce(clubs.lng, club_parsed.lng_raw),
    map_source = coalesce(nullif(clubs.map_source, ''), case when club_parsed.map_link <> '' then 'manual_link' else null end)
  from club_parsed
  where clubs.id = club_parsed.id
    and club_parsed.map_link <> ''
    and (
      coalesce(nullif(clubs.place_id, ''), '') = ''
      or coalesce(nullif(clubs.formatted_address, ''), '') = ''
      or clubs.lat is null
      or clubs.lng is null
      or coalesce(nullif(clubs.map_source, ''), '') = ''
    )
  returning clubs.id
),
course_source as (
  select
    id,
    trim(coalesce(map_link, '')) as map_link,
    nullif(substring(trim(coalesce(map_link, '')) from '(?:[?&]query_place_id=)([^&#]+)'), '') as place_id_raw,
    nullif(substring(trim(coalesce(map_link, '')) from '(?:[?&](?:q|query|destination|daddr)=)([^&#]+)'), '') as query_raw,
    nullif(substring(trim(coalesce(map_link, '')) from '(?:[?&](?:center|ll)=)([^&#]+)'), '') as center_raw,
    nullif(substring(trim(coalesce(map_link, '')) from '@(-?\d+(?:\.\d+)?)'), '') as at_lat_raw,
    nullif(substring(trim(coalesce(map_link, '')) from '@-?\d+(?:\.\d+)?,(-?\d+(?:\.\d+)?)'), '') as at_lng_raw,
    nullif(substring(trim(coalesce(map_link, '')) from '/place/([^/?#]+)'), '') as place_path_raw
  from public.courses
),
course_parsed as (
  select
    id,
    map_link,
    place_id_raw,
    nullif(
      trim(both ' ' from
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(
                        replace(
                          case
                            when replace(replace(coalesce(query_raw, ''), '%2C', ','), '%2c', ',') ~ '^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$' then coalesce(place_path_raw, '')
                            else coalesce(query_raw, place_path_raw, '')
                          end,
                          '+', ' '
                        ),
                        '%20', ' '
                      ),
                      '%2C', ','
                    ),
                    '%2c', ','
                  ),
                  '%2F', '/'
                ),
                '%2f', '/'
              ),
              '%26', '&'
            ),
            '%28', '('
          ),
          '%29', ')'
        )
      ),
      ''
    ) as formatted_address_raw,
    case
      when replace(replace(coalesce(center_raw, ''), '%2C', ','), '%2c', ',') ~ '^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$'
        then split_part(replace(replace(center_raw, '%2C', ','), '%2c', ','), ',', 1)::double precision
      when replace(replace(coalesce(query_raw, ''), '%2C', ','), '%2c', ',') ~ '^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$'
        then split_part(replace(replace(query_raw, '%2C', ','), '%2c', ','), ',', 1)::double precision
      when at_lat_raw is not null
        then at_lat_raw::double precision
      else null
    end as lat_raw,
    case
      when replace(replace(coalesce(center_raw, ''), '%2C', ','), '%2c', ',') ~ '^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$'
        then split_part(replace(replace(center_raw, '%2C', ','), '%2c', ','), ',', 2)::double precision
      when replace(replace(coalesce(query_raw, ''), '%2C', ','), '%2c', ',') ~ '^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$'
        then split_part(replace(replace(query_raw, '%2C', ','), '%2c', ','), ',', 2)::double precision
      when at_lng_raw is not null
        then at_lng_raw::double precision
      else null
    end as lng_raw
  from course_source
),
updated_courses as (
  update public.courses as courses
  set
    place_id = coalesce(nullif(courses.place_id, ''), course_parsed.place_id_raw),
    formatted_address = coalesce(nullif(courses.formatted_address, ''), course_parsed.formatted_address_raw),
    lat = coalesce(courses.lat, course_parsed.lat_raw),
    lng = coalesce(courses.lng, course_parsed.lng_raw),
    map_source = coalesce(nullif(courses.map_source, ''), case when course_parsed.map_link <> '' then 'manual_link' else null end)
  from course_parsed
  where courses.id = course_parsed.id
    and course_parsed.map_link <> ''
    and (
      coalesce(nullif(courses.place_id, ''), '') = ''
      or coalesce(nullif(courses.formatted_address, ''), '') = ''
      or courses.lat is null
      or courses.lng is null
      or coalesce(nullif(courses.map_source, ''), '') = ''
    )
  returning courses.id
)
select 'clubs' as table_name, count(*) as updated_rows from updated_clubs
union all
select 'courses' as table_name, count(*) as updated_rows from updated_courses;
