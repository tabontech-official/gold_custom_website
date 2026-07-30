type LineAttribute = {key: string; value?: string | null};

type CartLineLike = {
  merchandise?: {id?: string | null} | null;
  attributes?: Array<LineAttribute> | null;
};

type RequestedLine = {
  merchandiseId: string;
  attributes?: Array<LineAttribute> | null;
};

/**
 * True when the cart already holds a line for every requested line. Drives the
 * locked "Added to bag" state on the product page, which unlocks again as soon
 * as the line leaves the cart.
 */
export function isInCart(
  cart: {lines?: {nodes?: Array<CartLineLike> | null} | null} | null | undefined,
  lines: Array<RequestedLine>,
) {
  const cartLines = cart?.lines?.nodes ?? [];

  return (
    lines.length > 0 &&
    lines.every((line) =>
      cartLines.some(
        (cartLine) =>
          cartLine.merchandise?.id === line.merchandiseId &&
          // Same variant with a different ring size is a separate line, so
          // every requested attribute has to match as well. Extra attributes
          // on the cart line (gift notes, etc.) are ignored.
          (line.attributes ?? []).every((attribute) =>
            cartLine.attributes?.some(
              (cartAttribute) =>
                cartAttribute.key === attribute.key &&
                cartAttribute.value === attribute.value,
            ),
          ),
      ),
    )
  );
}
