import React from 'react';
import { Icon, PlatformIcon } from './icons.jsx';
import { WorkspaceAvatar } from './Shell.jsx';
import { Spinner, cx } from './ui.jsx';

// How a post will look on each platform (an approximation, not pixel perfect)

const ImageSlot = ({ image, loading, onOpen, aspect }) => {
  if (loading) {
    return (
      <div className={cx('w-full flex flex-col items-center justify-center gap-2 bg-black/5 text-slate-400', aspect)}>
        <Spinner />
        <span className="text-xs">Making the image</span>
      </div>
    );
  }
  if (!image) return null;
  return (
    <button onClick={onOpen} className="block w-full">
      <img src={image} alt="Post image" className={cx('w-full object-cover', aspect)} />
    </button>
  );
};

const Text = ({ children, className }) => (
  <p className={cx('whitespace-pre-wrap break-words leading-relaxed', className)}>{children}</p>
);

export const PostPreview = ({ platform, content, image, imageLoading, workspace, onOpenImage }) => {
  const name = workspace?.name || 'Content Studio';
  const handle = (workspace?.slug === 'touchline' ? 'touchlinexyz' : workspace?.slug) || 'studio';

  if (platform === 'x') {
    return (
      <div className="rounded-2xl bg-black text-white border border-white/10 p-4">
        <div className="flex gap-3">
          <WorkspaceAvatar workspace={workspace} />
          <div className="flex-1 min-w-0">
            <p className="text-sm"><span className="font-bold">{name}</span> <span className="text-white/50">@{handle} · now</span></p>
            <Text className="text-[15px] mt-1">{content}</Text>
            {(image || imageLoading) && (
              <div className="mt-3 rounded-2xl overflow-hidden border border-white/10">
                <ImageSlot image={image} loading={imageLoading} onOpen={onOpenImage} aspect="aspect-video" />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (platform === 'instagram') {
    return (
      <div className="rounded-2xl bg-white text-slate-900 border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <WorkspaceAvatar workspace={workspace} size="sm" />
          <span className="text-sm font-semibold">{handle}</span>
        </div>
        {(image || imageLoading)
          ? <ImageSlot image={image} loading={imageLoading} onOpen={onOpenImage} aspect="aspect-[4/5]" />
          : <div className="aspect-[4/5] bg-slate-100 flex items-center justify-center text-xs text-slate-400">Instagram posts need an image</div>}
        <div className="px-3 py-3">
          <Text className="text-sm"><span className="font-semibold mr-1.5">{handle}</span>{content}</Text>
        </div>
      </div>
    );
  }

  // LinkedIn and Facebook
  return (
    <div className="rounded-2xl bg-white text-slate-900 border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4">
        <WorkspaceAvatar workspace={workspace} />
        <div>
          <p className="text-sm font-semibold leading-tight">{name}</p>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            Now · <Icon name="globe" className="w-3 h-3" />
          </p>
        </div>
        <span className="ml-auto text-slate-300"><PlatformIcon platform={platform} className="w-4 h-4" /></span>
      </div>
      <Text className="text-sm px-4 py-3">{content}</Text>
      {(image || imageLoading) && <ImageSlot image={image} loading={imageLoading} onOpen={onOpenImage} aspect="aspect-square" />}
    </div>
  );
};
