'use client';

interface WhatsAppPreviewProps {
  text?: string;
  imageUrl?: string;
  caption?: string;
  showText?: boolean;
  showImage?: boolean;
}

export default function WhatsAppPreview({
  text,
  imageUrl,
  caption,
  showText,
  showImage,
}: WhatsAppPreviewProps) {
  const hasContent = (showText && text) || (showImage && (imageUrl || caption));

  return (
    <div className="bg-[#e5ddd5] rounded-xl p-4 min-h-[300px]">
      <p className="text-center text-xs text-gray-500 mb-3">Preview WhatsApp</p>

      {/* Background com padrão do WhatsApp */}
      <div className="space-y-2">
        {!hasContent && (
          <div className="text-center text-gray-400 py-8 text-sm">
            Configure seu anúncio para ver o preview
          </div>
        )}

        {/* Mensagem de texto */}
        {showText && text && (
          <div className="flex justify-end">
            <div className="bg-[#dcf8c6] rounded-lg rounded-tr-none p-3 max-w-[85%] shadow-sm">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{text}</p>
              <p className="text-[10px] text-gray-500 text-right mt-1">12:00 ✓✓</p>
            </div>
          </div>
        )}

        {/* Mensagem com imagem */}
        {showImage && (imageUrl || caption) && (
          <div className="flex justify-end">
            <div className="bg-[#dcf8c6] rounded-lg rounded-tr-none max-w-[85%] shadow-sm overflow-hidden">
              {imageUrl && (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="w-full h-40 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="160" fill="%23ccc"><rect width="200" height="160"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23999" font-size="14">Imagem</text></svg>';
                    }}
                  />
                </div>
              )}
              {caption && (
                <div className="p-3">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{caption}</p>
                </div>
              )}
              <p className="text-[10px] text-gray-500 text-right px-3 pb-2">12:00 ✓✓</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
