import * as React from 'react';
import {Pagination} from '@shopify/hydrogen';

/**
 * Append-style "Load More" grid. Hydrogen's <Pagination> accumulates the nodes
 * across pages, so tapping "Load More" grows the grid instead of replacing it.
 */
export function PaginatedResourceSection<NodesType>({
  connection,
  children,
  resourcesClassName,
}: {
  connection: React.ComponentProps<typeof Pagination<NodesType>>['connection'];
  children: React.FunctionComponent<{node: NodesType; index: number}>;
  resourcesClassName?: string;
}) {
  return (
    <Pagination connection={connection}>
      {({nodes, isLoading, PreviousLink, NextLink, hasNextPage, hasPreviousPage}) => {
        const resourcesMarkup = nodes.map((node, index) =>
          children({node, index}),
        );

        return (
          <div className="load-more">
            {hasPreviousPage && (
              <div className="load-more-bar">
                <PreviousLink className="load-more-btn is-ghost">
                  {isLoading ? 'Loading…' : '↑ Load previous'}
                </PreviousLink>
              </div>
            )}

            {resourcesClassName ? (
              <div className={resourcesClassName}>{resourcesMarkup}</div>
            ) : (
              resourcesMarkup
            )}

            <div className="load-more-bar">
              <span className="load-more-count">{nodes.length} pieces shown</span>
              {hasNextPage ? (
                <NextLink className="load-more-btn">
                  {isLoading ? 'Loading…' : 'Load More'}
                </NextLink>
              ) : (
                <span className="load-more-end">That&rsquo;s the whole collection</span>
              )}
            </div>
          </div>
        );
      }}
    </Pagination>
  );
}
