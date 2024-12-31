export interface VideoItemInterface
  extends Pick<
    Plex.Metadata,
    | "title"
    | "type"
    | "grandparentTitle"
    | "year"
    | "leafCount"
    | "viewedLeafCount"
    | "viewCount"
    | "childCount"
    | "rating"
    | "contentRating"
    | "duration"
    | "grandparentRatingKey"
    | "ratingKey"
    | "summary"
    | "viewOffset"
    | "parentTitle"
    | "OnDeck"
    | "Children"
    | "index"
    | "parentIndex"
  > {
  image: string;
}
