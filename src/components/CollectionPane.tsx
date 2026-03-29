interface CollectionPaneProps {
  imageCount: number;
}

export default function CollectionPane({ imageCount }: CollectionPaneProps) {
  return (
    <div className="pane__body">
      Collection Pane — {imageCount} images
    </div>
  );
}
