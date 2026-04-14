(function (window) {
  'use strict';

  function trimText(value) {
    return String(value || '').trim();
  }

  function normalizeCouponCode(value) {
    return trimText(value).toUpperCase();
  }

  function getSupabaseClientSafe() {
    try {
      return typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
    } catch (error) {
      return null;
    }
  }

  function isConfigured() {
    var config = window.APP_CONFIG || {};
    return !!(config.SUPABASE_URL && config.SUPABASE_ANON_KEY && getSupabaseClientSafe());
  }

  function isMissingMembershipSchema(error) {
    var text = trimText(error && (error.message || error.details || error.hint || error.code)).toLowerCase();
    return text.indexOf('user_memberships') > -1
      || text.indexOf('activate_sports_membership') > -1
      || text.indexOf('get_my_active_sports_membership') > -1
      || text.indexOf('validate_my_sports_membership_coupon') > -1
      || text.indexOf('generate_membership_coupon_code') > -1;
  }

  function normalizeStatus(row) {
    var status = trimText(row && row.status).toLowerCase() || 'inactive';
    var expiresAt = trimText(row && row.expires_at);
    var expiresTs = expiresAt ? Date.parse(expiresAt) : 0;
    if (status === 'active' && expiresTs && expiresTs <= Date.now()) {
      return 'expired';
    }
    return status;
  }

  function statusLabel(status) {
    if (status === 'active') return 'Active';
    if (status === 'expired') return 'Expired';
    if (status === 'cancelled') return 'Cancelled';
    return 'Inactive';
  }

  function mapMembershipRow(row) {
    var statusKey = normalizeStatus(row);
    var membershipType = trimText(row && row.membership_type) || 'sports';
    var rawPrice = Number(row && row.price);
    var normalizedPrice = membershipType === 'sports' && !(rawPrice > 0) ? 20 : rawPrice;
    return {
      id: trimText(row && row.id),
      userId: trimText(row && row.user_id),
      email: trimText(row && row.email).toLowerCase(),
      membershipType: membershipType,
      planName: trimText(row && row.plan_name) || 'Sports Membership',
      statusKey: statusKey,
      status: statusLabel(statusKey),
      billingCycle: trimText(row && row.billing_cycle) || 'monthly',
      orderId: trimText(row && row.order_id),
      paymentMethod: trimText(row && row.payment_method) || 'Bank Card',
      price: normalizedPrice > 0 ? normalizedPrice : 20,
      couponCode: trimText(row && row.coupon_code),
      couponGeneratedAt: trimText(row && row.coupon_generated_at),
      couponDiscount: Number(row && row.coupon_discount || 0),
      startedAt: trimText(row && row.started_at),
      expiresAt: trimText(row && row.expires_at),
      createdAt: trimText(row && row.created_at),
      updatedAt: trimText(row && row.updated_at)
    };
  }

  function unwrapSingleMembershipRow(data) {
    if (Array.isArray(data)) {
      return data.length ? data[0] : null;
    }
    return data || null;
  }

  function mergeMembershipRows(rows, activeMembership) {
    var list = Array.isArray(rows) ? rows.slice() : [];
    if (!activeMembership || !activeMembership.id) {
      return list;
    }
    var exists = false;
    for (var i = 0; i < list.length; i += 1) {
      if (trimText(list[i] && list[i].id) === activeMembership.id) {
        list[i] = activeMembership;
        exists = true;
        break;
      }
    }
    if (!exists) {
      list.unshift(activeMembership);
    }
    return list;
  }

  async function resolveMembershipUserId(userId) {
    var client = getSupabaseClientSafe();
    if (client && client.auth && typeof client.auth.getUser === 'function') {
      try {
        var authResult = await client.auth.getUser();
        var authUser = authResult && authResult.data && authResult.data.user;
        if (authUser && trimText(authUser.id)) {
          return trimText(authUser.id);
        }
      } catch (error) {}
    }
    return trimText(userId);
  }

  async function getCurrentAuthenticatedMember() {
    var client = getSupabaseClientSafe();
    if (!client || !client.auth || typeof client.auth.getUser !== 'function') {
      return null;
    }

    try {
      var authResult = await client.auth.getUser();
      var authUser = authResult && authResult.data && authResult.data.user;
      if (!authUser || !trimText(authUser.id)) {
        return null;
      }
      return {
        userId: trimText(authUser.id),
        email: trimText(authUser.email).toLowerCase()
      };
    } catch (error) {
      return null;
    }
  }

  async function fetchMyMemberships(userId) {
    var client = getSupabaseClientSafe();
    if (!client) return [];

    var resolvedUserId = await resolveMembershipUserId(userId);
    if (!resolvedUserId) return [];

    var activeMembership = null;
    try {
      var activeResult = await client.rpc('get_my_active_sports_membership');
      if (!(activeResult && activeResult.error)) {
        var activeRow = unwrapSingleMembershipRow(activeResult && activeResult.data);
        if (activeRow) {
          var mappedActiveRow = mapMembershipRow(activeRow);
          if (mappedActiveRow && mappedActiveRow.membershipType === 'sports' && mappedActiveRow.statusKey === 'active') {
            activeMembership = mappedActiveRow;
          }
        }
      }
    } catch (error) {}

    var result = await client
      .from('user_memberships')
      .select('id, user_id, email, membership_type, plan_name, status, billing_cycle, order_id, payment_method, price, coupon_code, coupon_generated_at, coupon_discount, started_at, expires_at, created_at, updated_at')
      .eq('user_id', resolvedUserId)
      .order('created_at', { ascending: false });

    if (result.error) {
      if (isMissingMembershipSchema(result.error)) return activeMembership ? [activeMembership] : [];
      if (activeMembership) return [activeMembership];
      throw result.error;
    }

    return mergeMembershipRows((result.data || []).map(mapMembershipRow), activeMembership);
  }

  async function fetchActiveSportsMembership(userId) {
    var client = getSupabaseClientSafe();
    if (client) {
      var rpcResult = await client.rpc('get_my_active_sports_membership');
      if (rpcResult && rpcResult.error) {
        if (!isMissingMembershipSchema(rpcResult.error)) {
          throw rpcResult.error;
        }
      } else {
        var rpcRow = unwrapSingleMembershipRow(rpcResult && rpcResult.data);
        if (!rpcRow) {
          return null;
        }
        var mappedRpcRow = mapMembershipRow(rpcRow);
        if (mappedRpcRow && mappedRpcRow.membershipType === 'sports' && mappedRpcRow.statusKey === 'active') {
          return mappedRpcRow;
        }
        return null;
      }
    }

    var rows = await fetchMyMemberships(userId);
    for (var i = 0; i < rows.length; i += 1) {
      if (rows[i] && rows[i].membershipType === 'sports' && rows[i].statusKey === 'active') {
        return rows[i];
      }
    }
    return null;
  }

  async function validateSportsMembershipCoupon(userId, code) {
    var client = getSupabaseClientSafe();
    if (client) {
      var rpcResult = await client.rpc('validate_my_sports_membership_coupon', {
        p_coupon_code: normalizeCouponCode(code)
      });
      if (rpcResult && rpcResult.error) {
        if (!isMissingMembershipSchema(rpcResult.error)) {
          throw rpcResult.error;
        }
      } else {
        var rpcRow = unwrapSingleMembershipRow(rpcResult && rpcResult.data);
        if (!rpcRow) {
          return null;
        }
        var mappedRpcRow = mapMembershipRow(rpcRow);
        if (mappedRpcRow && mappedRpcRow.membershipType === 'sports' && mappedRpcRow.statusKey === 'active') {
          return mappedRpcRow;
        }
        return null;
      }
    }

    var membership = await fetchActiveSportsMembership(userId);
    if (!membership) return null;

    var membershipCode = normalizeCouponCode(membership.couponCode);
    if (!membershipCode) return null;
    if (membershipCode !== normalizeCouponCode(code)) return null;

    return membership;
  }

  function mapMembershipActionError(error) {
    var text = trimText(error && error.message).toLowerCase();
    if (text.indexOf('not_authenticated') > -1) return 'Please sign in again before joining the membership.';
    if (text.indexOf('missing_order_id') > -1) return 'This membership order is missing its payment reference. Please refresh and try again.';
    if (text.indexOf('missing_coupon_code') > -1) return 'Please enter the six-character membership code first.';
    if (text.indexOf('already_active') > -1) return 'This account already has an active Sports Membership.';
    if (text.indexOf('duplicate key') > -1 || text.indexOf('unique constraint') > -1) return 'This account already has an active Sports Membership.';
    if (text.indexOf('membership_activation_not_confirmed') > -1) return 'Payment was submitted, but the membership record was not confirmed in the database. Please refresh and try again.';
    if (text.indexOf('coupon_generation_failed') > -1) return 'The weekly membership code could not be refreshed right now. Please try again.';
    if (text.indexOf('user_memberships') > -1 || text.indexOf('activate_sports_membership') > -1) {
      return 'Membership sync is not ready yet. Please run the latest membership SQL in Supabase first.';
    }
    return trimText(error && error.message) || 'Unable to activate the membership right now.';
  }

  async function insertSportsMembershipDirect(order, userId) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');

    var startedAt = new Date();
    var expiresAt = new Date(startedAt.getTime());
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    var result = await client
      .from('user_memberships')
      .insert({
        user_id: trimText(userId),
        email: trimText(order && order.userEmail).toLowerCase(),
        membership_type: 'sports',
        plan_name: trimText(order && order.planName) || 'Sports Membership',
        status: 'active',
        billing_cycle: trimText(order && order.billingCycle) || 'monthly',
        order_id: trimText(order && order.orderId),
        payment_method: trimText(order && order.paymentMethod) || 'Bank Card',
        price: Math.max(Number(order && order.price || 0), 0),
        coupon_code: null,
        coupon_discount: 0,
        started_at: startedAt.toISOString(),
        expires_at: expiresAt.toISOString()
      })
      .select('id, user_id, email, membership_type, plan_name, status, billing_cycle, order_id, payment_method, price, coupon_code, coupon_generated_at, coupon_discount, started_at, expires_at, created_at, updated_at');

    if (result.error) throw result.error;
    var insertedRow = unwrapSingleMembershipRow(result.data);
    return insertedRow ? mapMembershipRow(insertedRow) : null;
  }

  async function activateSportsMembership(order) {
    var client = getSupabaseClientSafe();
    if (!client) throw new Error('Supabase is not configured.');

    var resolvedUserId = await resolveMembershipUserId(order && order.userId);

    var result = await client.rpc('activate_sports_membership', {
      p_order_id: trimText(order && order.orderId),
      p_plan_name: trimText(order && order.planName) || 'Sports Membership',
      p_price: Number(order && order.price || 0),
      p_billing_cycle: trimText(order && order.billingCycle) || 'monthly',
      p_payment_method: trimText(order && order.paymentMethod) || 'Bank Card'
    });

    if (result.error) throw result.error;
    var rpcRow = unwrapSingleMembershipRow(result.data);
    var mappedRpcRow = rpcRow ? mapMembershipRow(rpcRow) : null;
    if (mappedRpcRow && mappedRpcRow.membershipType === 'sports' && mappedRpcRow.statusKey === 'active') {
      return mappedRpcRow;
    }

    var confirmedMembership = await fetchActiveSportsMembership(resolvedUserId);
    if (confirmedMembership) {
      return confirmedMembership;
    }

    try {
      var insertedMembership = await insertSportsMembershipDirect(order, resolvedUserId);
      if (insertedMembership && insertedMembership.membershipType === 'sports' && insertedMembership.statusKey === 'active') {
        return insertedMembership;
      }
    } catch (error) {
      var duplicateText = trimText(error && error.message).toLowerCase();
      if (duplicateText.indexOf('duplicate key') === -1 && duplicateText.indexOf('unique constraint') === -1) {
        throw error;
      }
    }

    confirmedMembership = await fetchActiveSportsMembership(resolvedUserId);
    if (confirmedMembership) {
      return confirmedMembership;
    }

    throw new Error('membership_activation_not_confirmed');
  }

  window.clubMembershipSupabase = {
    isConfigured: isConfigured,
    getCurrentAuthenticatedMember: getCurrentAuthenticatedMember,
    fetchMyMemberships: fetchMyMemberships,
    fetchActiveSportsMembership: fetchActiveSportsMembership,
    validateSportsMembershipCoupon: validateSportsMembershipCoupon,
    activateSportsMembership: activateSportsMembership,
    mapMembershipActionError: mapMembershipActionError
  };
})(window);
