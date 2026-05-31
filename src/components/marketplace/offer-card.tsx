"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Coins } from "lucide-react";

import {
  acceptBid,
  cancelOffer,
  completeOffer,
  hireOffer,
  placeBid,
  withdrawBid,
} from "@/app/_actions/marketplace";
import { ProfileLink } from "@/components/profile/profile-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import { UserName } from "@/components/user-name";
import { copy } from "@/lib/copy";
import type { MemberMap } from "@/lib/members";
import { cn } from "@/lib/utils";
import type { ServiceBid, ServiceOffer } from "@/types/database";

export function OfferCard({
  offer,
  bids,
  members,
  userId,
  balance,
  onBalance,
}: {
  offer: ServiceOffer;
  bids: ServiceBid[];
  members: MemberMap;
  userId: string;
  balance: number;
  onBalance: (n: number) => void;
}) {
  const [pending, start] = useTransition();
  const [bidPrice, setBidPrice] = useState(offer.price);

  const isAuthor = offer.author_id === userId;
  const isRequest = offer.kind === "request";
  const authorName = members[offer.author_id]?.name ?? "—";
  const myBid = bids.find((b) => b.bidder_id === userId);
  const sortedBids = [...bids].sort((a, b) => a.price - b.price);

  function run(fn: () => Promise<{ ok: boolean; error?: string; balance?: number }>, okMsg?: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error ?? copy.marketplace.error);
        return;
      }
      if (typeof res.balance === "number") onBalance(res.balance);
      if (okMsg) toast.success(okMsg);
    });
  }

  return (
    <Card className={cn(offer.status === "done" && "opacity-60")}>
      <CardContent className="space-y-2 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                  isRequest
                    ? "bg-sky-500/15 text-sky-500"
                    : "bg-emerald-500/15 text-emerald-500",
                )}
              >
                {isRequest ? copy.marketplace.kindRequest : copy.marketplace.kindOffer}
              </span>
              <h3 className="truncate font-semibold">{offer.title}</h3>
            </div>
            <ProfileLink
              userId={offer.author_id}
              className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <UserAvatar
                name={authorName}
                avatarUrl={members[offer.author_id]?.avatarUrl}
                className="size-4"
                fallbackClassName="text-[8px]"
                loadout={members[offer.author_id]?.loadout}
              />
              <span className="inline-flex items-center gap-1">
                {copy.marketplace.byline}
                <UserName
                  name={authorName}
                  loadout={members[offer.author_id]?.loadout}
                />
              </span>
            </ProfileLink>
          </div>
          <span className="flex shrink-0 items-center gap-1 font-mono text-sm font-semibold tabular-nums text-amber-500">
            <Coins className="size-4" />
            {offer.agreed_price ?? offer.price}
          </span>
        </div>

        {offer.description && (
          <p className="text-sm text-muted-foreground">{offer.description}</p>
        )}

        {/* Done / hired status */}
        {offer.status === "done" && (
          <p className="text-sm font-medium text-emerald-500">
            {copy.marketplace.done}
          </p>
        )}
        {offer.status === "hired" && offer.hired_by && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">
              {isAuthor
                ? isRequest
                  ? copy.marketplace.acceptedFrom(
                      members[offer.hired_by]?.name ?? "—",
                    )
                  : copy.marketplace.hiredBy(members[offer.hired_by]?.name ?? "—")
                : offer.hired_by === userId
                  ? copy.marketplace.youHired
                  : copy.marketplace.hiredBy(members[offer.hired_by]?.name ?? "—")}
            </span>
            {isAuthor && (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => completeOffer(offer.id))}
              >
                {copy.marketplace.complete}
              </Button>
            )}
          </div>
        )}

        {/* Open: offer → hire/cancel; request → bids */}
        {offer.status === "open" && !isRequest && (
          <div className="flex justify-end gap-2">
            {isAuthor ? (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => cancelOffer(offer.id))}
              >
                {copy.marketplace.cancel}
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={pending || balance < offer.price}
                onClick={() =>
                  run(
                    () => hireOffer(offer.id),
                    copy.marketplace.hiredToast(offer.price),
                  )
                }
              >
                {copy.marketplace.hire(offer.price)}
              </Button>
            )}
          </div>
        )}

        {offer.status === "open" && isRequest && (
          <div className="space-y-2 border-t pt-2">
            <p className="text-xs font-medium text-muted-foreground">
              {copy.marketplace.bidsLabel}
            </p>
            {sortedBids.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {copy.marketplace.noBids}
              </p>
            ) : (
              <ul className="space-y-1">
                {sortedBids.map((bid) => (
                  <li
                    key={bid.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="min-w-0 truncate">
                      <ProfileLink userId={bid.bidder_id}>
                        <UserName
                          name={members[bid.bidder_id]?.name ?? "—"}
                          loadout={members[bid.bidder_id]?.loadout}
                        />
                      </ProfileLink>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono tabular-nums text-amber-500">
                        {bid.price}
                      </span>
                      {isAuthor && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending || balance < bid.price}
                          onClick={() =>
                            run(
                              () => acceptBid(bid.id),
                              copy.marketplace.paidToast(
                                members[bid.bidder_id]?.name ?? "—",
                                bid.price,
                              ),
                            )
                          }
                        >
                          {copy.marketplace.accept}
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* Non-author can bid */}
            {!isAuthor &&
              (myBid ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm">
                    {copy.marketplace.yourBid(myBid.price)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => run(() => withdrawBid(offer.id))}
                  >
                    {copy.marketplace.withdrawBid}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={bidPrice}
                    onChange={(e) =>
                      setBidPrice(Math.max(1, Math.floor(Number(e.target.value) || 0)))
                    }
                    placeholder={copy.marketplace.bidPlaceholder}
                    className="h-8"
                  />
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => placeBid({ offerId: offer.id, price: bidPrice }),
                        copy.marketplace.bidPlaced,
                      )
                    }
                  >
                    {copy.marketplace.bid}
                  </Button>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
