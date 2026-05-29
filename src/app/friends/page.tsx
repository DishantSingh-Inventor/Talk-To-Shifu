"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Users, Clock, UserCheck, X } from "lucide-react";
import styles from "./friends.module.css";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { useEffect } from "react";
import { Id } from "../../../convex/_generated/dataModel";

export default function FriendsPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  const friends = useQuery(api.friends.listFriends, isAuthenticated ? {} : "skip") || [];
  const pendingRequests = useQuery(api.friends.listPendingRequests, isAuthenticated ? {} : "skip") || [];
  
  const sendRequest = useMutation(api.friends.sendFriendRequest);
  const updateStatus = useMutation(api.friends.updateFriendStatus);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, isLoading, router]);

  const handleAccept = async (userId: Id<"users">) => {
    // sendFriendRequest accepts reciprocal requests
    await sendRequest({ targetId: userId });
  };

  const handleDecline = async (friendRecordId: Id<"friends">) => {
    await updateStatus({ friendRecordId, action: "decline" });
  };

  const handleRemove = async (friendRecordId: Id<"friends">) => {
    await updateStatus({ friendRecordId, action: "remove" });
  };

  if (isLoading || !isAuthenticated) {
    return <div className={styles.container}><p>Loading...</p></div>;
  }

  return (
    <main className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>Friends</h1>

        {/* Pending Requests Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <Clock className={styles.sectionIcon} size={24} />
            Pending Requests
          </h2>
          {pendingRequests.length > 0 ? (
            <div className={styles.list}>
              {pendingRequests.map((req) => (
                <div key={req._id} className={styles.card}>
                  <div className={styles.userInfo}>
                    <div className={styles.avatar}>
                      <UserCheck size={24} />
                    </div>
                    {/* Ideally we fetch the user's name/profile, but for now we just show their ID */}
                    <p className={styles.userName}>User: {req.userId}</p>
                  </div>
                  <div className={styles.actions}>
                    <button 
                      className={styles.btnAccept}
                      onClick={() => void handleAccept(req.userId)}
                    >
                      Accept
                    </button>
                    <button 
                      className={styles.btnDecline}
                      onClick={() => void handleDecline(req._id)}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.emptyState}>No pending friend requests.</p>
          )}
        </section>

        {/* Friends List Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <Users className={styles.sectionIcon} size={24} />
            My Friends
          </h2>
          {friends.length > 0 ? (
            <div className={styles.list}>
              {friends.map((friend) => (
                <div key={friend._id} className={styles.card}>
                  <div className={styles.userInfo}>
                    <div className={styles.avatar}>
                      <Users size={24} />
                    </div>
                    <p className={styles.userName}>
                      Friend: {friend.friendId} {/* Display logic needs to handle whether friendId or userId is the other user */}
                    </p>
                  </div>
                  <div className={styles.actions}>
                    <button 
                      className={styles.btnRemove}
                      onClick={() => void handleRemove(friend._id)}
                      title="Remove Friend"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.emptyState}>You have no friends added yet.</p>
          )}
        </section>

      </div>
    </main>
  );
}
