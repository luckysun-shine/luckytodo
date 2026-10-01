/**
 * Shared check-in helper: text feedback + optional photo (S3 growth).
 */
export async function collectCheckinPayload(api, { planId, memberId, date }) {
  const feedback = prompt('一句反馈（可空）') || '';
  let photoMediaId = null;
  const wantPhoto = confirm('要附一张打卡照片吗？');
  if (wantPhoto) {
    photoMediaId = await new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        try {
          const media = await api.uploadMedia(file, {
            purpose: 'attachment',
            parentType: 'checkin',
            parentId: planId,
          });
          resolve(media.id);
        } catch (e) {
          alert(e.message);
          resolve(null);
        }
      };
      input.click();
    });
  }
  return {
    planId,
    memberId,
    date,
    status: 'done',
    feedback,
    photoMediaId,
  };
}
