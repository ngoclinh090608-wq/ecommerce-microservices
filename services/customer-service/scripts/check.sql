SELECT c.uid, c.fullname, c.mid, m.mname, m.score
FROM "Customer" c JOIN "MemberShip" m USING (mid)
ORDER BY c.uid;